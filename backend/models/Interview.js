const { PutCommand, GetCommand, QueryCommand, ScanCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');
const { docClient, isPlaceholderKey } = require('../config/dynamodb');
const { v4: uuidv4 } = require('uuid');

const TABLE_NAME = process.env.DYNAMODB_INTERVIEW_TABLE || 'MockMate_Interviews';
const localStore = new Map();

// Auto-create table on first load
const { DynamoDBClient, CreateTableCommand, DescribeTableCommand } = require('@aws-sdk/client-dynamodb');
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
          ],
          GlobalSecondaryIndexes: [{
            IndexName: 'UserIdIndex',
            KeySchema: [{ AttributeName: 'userId', KeyType: 'HASH' }],
            Projection: { ProjectionType: 'ALL' },
            ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 },
          }],
          ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 },
        }));
        console.log(`✅ DynamoDB table "${TABLE_NAME}" created.`);
      } catch (e) {
        console.warn(`⚠️ Could not create table ${TABLE_NAME}: ${e.message}`);
      }
    }
  }
})();

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

async function putItem(data) {
  const item = sanitizeForDynamo(data);
  delete item.save;
  delete item.toObject;

  if (docClient && !isPlaceholderKey) {
    try {
      await docClient.send(new PutCommand({ TableName: TABLE_NAME, Item: item }));
    } catch (err) {
      console.warn(`⚠️ DynamoDB Interview put error: ${err.message}`);
      localStore.set(item.id, item);
    }
  } else {
    localStore.set(item.id, item);
  }
  return formatItem(item);
}

const InterviewModel = {
  async create(data) {
    const id = `int_${uuidv4().replace(/-/g, '')}`;
    const now = new Date().toISOString();
    const item = {
      id,
      _id: id,
      userId: String(data.userId || ''),
      role: data.role || 'Software Engineer',
      interviewType: data.interviewType || 'core_cs',
      difficulty: data.difficulty || 'medium',
      pricingTier: data.pricingTier || 'free',
      voiceAccent: data.voiceAccent || 'us-male',
      maxDurationMinutes: data.maxDurationMinutes || 15,
      status: data.status || 'scheduled',
      currentPhase: data.currentPhase || 'Introduction',
      exchangesInPhase: data.exchangesInPhase || 0,
      transcript: data.transcript || [],
      feedback: data.feedback || null,
      isPaid: Boolean(data.isPaid),
      paymentId: data.paymentId || null,
      orderId: data.orderId || null,
      recordingPath: data.recordingPath || null,
      recordingExpiresAt: data.recordingExpiresAt ? new Date(data.recordingExpiresAt).toISOString() : null,
      recordingUnlocked: Boolean(data.recordingUnlocked),
      recordingDeletedAt: data.recordingDeletedAt || null,
      reminderEmailSent: Boolean(data.reminderEmailSent),
      createdAt: data.createdAt || now,
      completedAt: data.completedAt || null,
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
          console.warn(`⚠️ DynamoDB Interview get error: ${err.message}`);
        }
      }
      const local = localStore.get(searchId);
      return local ? formatItem(local) : null;
    })();
    promise.populate = () => promise;
    return promise;
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
          console.warn(`⚠️ DynamoDB Interview scan/query error: ${err.message}`);
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
          if (typeof val === 'object' && val !== null && !Array.isArray(val)) {
            if (val.$lt && !(item[key] && new Date(item[key]) < new Date(val.$lt))) return false;
            if (val.$gt && !(item[key] && new Date(item[key]) > new Date(val.$gt))) return false;
            if (val.$lte && !(item[key] && new Date(item[key]) <= new Date(val.$lte))) return false;
            if (val.$ne && item[key] === val.$ne) return false;
            continue;
          }
          if (val === null) {
            if (item[key] !== null && item[key] !== undefined) return false;
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

    // Return a thenable query builder so .sort()/.populate() can be chained before await
    const queryBuilder = {
      sort(sortObj) {
        _sortObj = sortObj;
        return queryBuilder;
      },
      populate() {
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

module.exports = InterviewModel;
