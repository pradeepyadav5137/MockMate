const { PutCommand, GetCommand, QueryCommand, ScanCommand } = require('@aws-sdk/lib-dynamodb');
const { docClient, isPlaceholderKey } = require('../config/dynamodb');
const { v4: uuidv4 } = require('uuid');

const TABLE_NAME = process.env.DYNAMODB_TICKET_TABLE || 'MockMate_Tickets';
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
      console.warn(`⚠️ DynamoDB Ticket put error: ${err.message}`);
      localStore.set(item.id, item);
    }
  } else {
    localStore.set(item.id, item);
  }
  return formatItem(item);
}

// Generate a readable ticket ID like TKT-A3F7K2
function generateTicketId() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no ambiguous chars
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `TKT-${code}`;
}

const VALID_CATEGORIES = ['Interview Issue', 'Payment Issue', 'Recording Issue', 'Feedback Issue', 'Account Issue', 'Other'];
const VALID_STATUSES = ['Open', 'In Progress', 'Resolved', 'Closed'];

const TicketModel = {
  VALID_CATEGORIES,
  VALID_STATUSES,

  async create(data) {
    const id = `tkt_${uuidv4().replace(/-/g, '')}`;
    const now = new Date().toISOString();
    const item = {
      id,
      _id: id,
      ticketId: generateTicketId(),
      userId: data.userId || null,               // null for guest tickets
      guestEmail: data.guestEmail || null,        // set for guest tickets
      isGuest: Boolean(data.isGuest),
      subject: String(data.subject || '').trim(),
      category: VALID_CATEGORIES.includes(data.category) ? data.category : 'Other',
      description: String(data.description || '').trim(),
      attachmentPath: data.attachmentPath || null,
      attachmentOriginalName: data.attachmentOriginalName || null,
      status: 'Open',
      createdAt: now,
      updatedAt: now,
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
          console.warn(`⚠️ DynamoDB Ticket get error: ${err.message}`);
        }
      }
      const local = localStore.get(searchId);
      return local ? formatItem(local) : null;
    })();
    return promise;
  },

  // Find by readable ticket ID (e.g. TKT-A3F7K2)
  async findByTicketId(ticketId) {
    if (!ticketId) return null;
    if (docClient && !isPlaceholderKey) {
      try {
        const res = await docClient.send(new ScanCommand({
          TableName: TABLE_NAME,
          FilterExpression: 'ticketId = :tid',
          ExpressionAttributeValues: { ':tid': ticketId },
        }));
        if (res.Items && res.Items.length > 0) return formatItem(res.Items[0]);
      } catch (err) {
        console.warn(`⚠️ DynamoDB Ticket scan error: ${err.message}`);
      }
    }
    for (const t of localStore.values()) {
      if (t.ticketId === ticketId) return formatItem(t);
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
          console.warn(`⚠️ DynamoDB Ticket scan/query error: ${err.message}`);
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

module.exports = TicketModel;
