const { PutCommand, GetCommand, QueryCommand, ScanCommand } = require('@aws-sdk/lib-dynamodb');
const { docClient, isPlaceholderKey } = require('../config/dynamodb');
const { v4: uuidv4 } = require('uuid');

const TABLE_NAME = process.env.DYNAMODB_USER_FEEDBACK_TABLE || 'MockMate_UserFeedback';
const localStore = new Map();

// Auto-create table on first load
const { CreateTableCommand, DescribeTableCommand } = require('@aws-sdk/client-dynamodb');
const { ddbClient } = require('../config/dynamodb');

(async () => {
  if (!ddbClient) return;
  try {
    await ddbClient.send(new DescribeTableCommand({ TableName: TABLE_NAME }));
  } catch (err) {
    if (err.name === 'ResourceNotFoundException') {
      try {
        await ddbClient.send(new CreateTableCommand({
          TableName: TABLE_NAME,
          KeySchema: [{ AttributeName: 'id', KeyType: 'HASH' }],
          AttributeDefinitions: [
            { AttributeName: 'id', AttributeType: 'S' },
            { AttributeName: 'userId', AttributeType: 'S' },
            { AttributeName: 'interviewId', AttributeType: 'S' },
          ],
          GlobalSecondaryIndexes: [
            {
              IndexName: 'UserIdIndex',
              KeySchema: [{ AttributeName: 'userId', KeyType: 'HASH' }],
              Projection: { ProjectionType: 'ALL' },
              ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 },
            },
            {
              IndexName: 'InterviewIdIndex',
              KeySchema: [{ AttributeName: 'interviewId', KeyType: 'HASH' }],
              Projection: { ProjectionType: 'ALL' },
              ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 },
            },
          ],
          ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 },
        }));
        console.log(`✅ DynamoDB table "${TABLE_NAME}" created.`);
      } catch (e) {
        console.warn(`⚠️ Could not create table ${TABLE_NAME}: ${e.message}`);
      }
    }
  }
})();

// Deep-sanitize: convert all Date objects (including nested) to ISO strings
function sanitizeForDynamo(obj) {
  if (obj === null || obj === undefined) return null;
  if (obj instanceof Date) return obj.toISOString();
  if (Array.isArray(obj)) return obj.map(sanitizeForDynamo);
  if (typeof obj === 'object') {
    const clean = {};
    for (const [k, v] of Object.entries(obj)) {
      clean[k] = v === undefined ? null : sanitizeForDynamo(v);
    }
    return clean;
  }
  return obj;
}

const formatItem = (item) => {
  if (!item) return null;
  const obj = { ...item, _id: item.id };
  obj.save = async function () {
    const data = { ...this };
    delete data.save;
    delete data.toObject;
    return putItem(data);
  };
  obj.toObject = function () {
    const plain = { ...this };
    delete plain.save;
    delete plain.toObject;
    return plain;
  };
  return obj;
};

async function putItem(data) {
  const item = sanitizeForDynamo(data);
  delete item.save;
  delete item.toObject;

  if (docClient && !isPlaceholderKey) {
    try {
      await docClient.send(new PutCommand({ TableName: TABLE_NAME, Item: item }));
    } catch (err) {
      console.warn(`⚠️ DynamoDB UserFeedback put error: ${err.message}`);
      localStore.set(item.id, item);
    }
  } else {
    localStore.set(item.id, item);
  }
  return formatItem(item);
}

const VALID_TYPES = ['testimony', 'improvement'];
const VALID_RECOMMEND = ['Yes', 'Maybe', 'No'];

const UserFeedbackModel = {
  VALID_TYPES,
  VALID_RECOMMEND,

  async create(data) {
    const id = `ufb_${uuidv4().replace(/-/g, '')}`;
    const now = new Date().toISOString();
    const item = {
      id,
      _id: id,
      userId: String(data.userId || ''),
      interviewId: String(data.interviewId || ''),
      type: VALID_TYPES.includes(data.type) ? data.type : 'testimony',

      // Ratings (1-5 stars)
      overallRating: Math.min(5, Math.max(1, Number(data.overallRating) || 0)),
      interviewQualityRating: Math.min(5, Math.max(1, Number(data.interviewQualityRating) || 0)),
      aiVoiceQualityRating: Math.min(5, Math.max(1, Number(data.aiVoiceQualityRating) || 0)),
      questionRelevanceRating: Math.min(5, Math.max(1, Number(data.questionRelevanceRating) || 0)),

      // Text feedback
      feedbackText: String(data.feedbackText || '').trim().slice(0, 5000),
      wouldRecommend: VALID_RECOMMEND.includes(data.wouldRecommend) ? data.wouldRecommend : null,

      // New Testimony Fields
      helpfulFor: data.helpfulFor || null,
      companyName: data.companyName || null,

      // Interview metadata (auto-stored from interview record)
      interviewCategory: data.interviewCategory || null,
      planUsed: data.planUsed || null,
      ttsProvider: data.ttsProvider || null,
      sttProvider: data.sttProvider || null,
      llmProvider: data.llmProvider || null,
      interviewDuration: data.interviewDuration || null,

      createdAt: now,
    };
    return putItem(item);
  },

  findById(id) {
    if (!id) return Promise.resolve(null);
    const searchId = String(id);
    const promise = (async () => {
      if (docClient && !isPlaceholderKey) {
        try {
          const res = await docClient.send(new GetCommand({ TableName: TABLE_NAME, Key: { id: searchId } }));
          if (res.Item) return formatItem(res.Item);
        } catch (err) {
          console.warn(`⚠️ DynamoDB UserFeedback get error: ${err.message}`);
        }
      }
      const local = localStore.get(searchId);
      return local ? formatItem(local) : null;
    })();
    return promise;
  },

  // Find feedback by interviewId (to check for duplicates)
  async findByInterviewId(interviewId) {
    if (!interviewId) return null;
    const iid = String(interviewId);

    if (docClient && !isPlaceholderKey) {
      try {
        const res = await docClient.send(new QueryCommand({
          TableName: TABLE_NAME,
          IndexName: 'InterviewIdIndex',
          KeyConditionExpression: 'interviewId = :iid',
          ExpressionAttributeValues: { ':iid': iid },
        }));
        if (res.Items && res.Items.length > 0) return formatItem(res.Items[0]);
      } catch (err) {
        console.warn(`⚠️ DynamoDB UserFeedback query error: ${err.message}`);
      }
    }
    for (const fb of localStore.values()) {
      if (fb.interviewId === iid) return formatItem(fb);
    }
    return null;
  },

  find(query = {}) {
    let _sortObj = null;

    const execute = async () => {
      let items = [];

      if (docClient && !isPlaceholderKey) {
        try {
          if (query.userId) {
            const res = await docClient.send(new QueryCommand({
              TableName: TABLE_NAME,
              IndexName: 'UserIdIndex',
              KeyConditionExpression: 'userId = :uid',
              ExpressionAttributeValues: { ':uid': String(query.userId) },
            }));
            items = res.Items || [];
          } else {
            const res = await docClient.send(new ScanCommand({ TableName: TABLE_NAME }));
            items = res.Items || [];
          }
        } catch (err) {
          console.warn(`⚠️ DynamoDB UserFeedback scan/query error: ${err.message}`);
          items = Array.from(localStore.values());
        }
      } else {
        items = Array.from(localStore.values());
      }

      // Apply filters client-side
      items = items.filter((item) => {
        for (const [key, val] of Object.entries(query)) {
          if (key === 'userId') {
            if (String(item.userId) !== String(val)) return false;
            continue;
          }
          if (item[key] !== val) return false;
        }
        return true;
      });

      // Apply sort
      if (_sortObj) {
        const key = Object.keys(_sortObj)[0];
        const dir = _sortObj[key];
        items.sort((a, b) => {
          const aVal = a[key] || '';
          const bVal = b[key] || '';
          return dir === -1 ? (bVal > aVal ? 1 : -1) : (aVal > bVal ? 1 : -1);
        });
      }

      return items.map(formatItem);
    };

    const queryBuilder = {
      sort(sortObj) {
        _sortObj = sortObj;
        return queryBuilder;
      },
      then(resolve, reject) {
        return execute().then(resolve, reject);
      },
      catch(reject) {
        return execute().catch(reject);
      },
    };

    return queryBuilder;
  },
};

module.exports = UserFeedbackModel;
