const { PutCommand, GetCommand, QueryCommand, ScanCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');
const { docClient, isPlaceholderKey } = require('../config/dynamodb');
const { v4: uuidv4 } = require('uuid');

const TABLE_NAME = process.env.DYNAMODB_PAYMENT_TABLE || 'MockMate_Payments';
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
            { AttributeName: 'razorpayOrderId', AttributeType: 'S' },
            { AttributeName: 'idempotencyKey', AttributeType: 'S' },
          ],
          GlobalSecondaryIndexes: [
            {
              IndexName: 'RazorpayOrderIdIndex',
              KeySchema: [{ AttributeName: 'razorpayOrderId', KeyType: 'HASH' }],
              Projection: { ProjectionType: 'ALL' },
              ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 },
            },
            {
              IndexName: 'IdempotencyKeyIndex',
              KeySchema: [{ AttributeName: 'idempotencyKey', KeyType: 'HASH' }],
              Projection: { ProjectionType: 'ALL' },
              ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 },
            }
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
      console.warn(`⚠️ DynamoDB Payment put error: ${err.message}`);
      localStore.set(item.id, item);
    }
  } else {
    localStore.set(item.id, item);
  }
  return formatItem(item);
}

const PaymentModel = {
  async create(data) {
    const id = `pay_${uuidv4().replace(/-/g, '')}`;
    const now = new Date().toISOString();
    const item = {
      id,
      _id: id,
      userId: String(data.userId || ''),
      productCode: data.productCode || '',
      tier: data.tier || '',
      amount: data.amount || 0,
      currency: data.currency || 'INR',
      razorpayOrderId: data.razorpayOrderId || null,
      razorpayPaymentId: data.razorpayPaymentId || null,
      status: data.status || 'created',
      idempotencyKey: data.idempotencyKey || null,
      interviewId: data.interviewId || null,
      refundId: data.refundId || null,
      refundStatus: data.refundStatus || null,
      createdAt: data.createdAt || now,
      paidAt: data.paidAt || null,
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
          console.warn(`⚠️ DynamoDB Payment get error: ${err.message}`);
        }
      }
      const local = localStore.get(searchId);
      return local ? formatItem(local) : null;
    })();
    promise.populate = () => promise;
    return promise;
  },

  async findOne(query = {}) {
    let items = [];
    if (docClient && !isPlaceholderKey) {
      try {
        if (query.razorpayOrderId) {
          const res = await docClient.send(new QueryCommand({
            TableName: TABLE_NAME,
            IndexName: 'RazorpayOrderIdIndex',
            KeyConditionExpression: 'razorpayOrderId = :oid',
            ExpressionAttributeValues: { ':oid': String(query.razorpayOrderId) },
          }));
          items = res.Items || [];
        } else if (query.idempotencyKey) {
          const res = await docClient.send(new QueryCommand({
            TableName: TABLE_NAME,
            IndexName: 'IdempotencyKeyIndex',
            KeyConditionExpression: 'idempotencyKey = :ik',
            ExpressionAttributeValues: { ':ik': String(query.idempotencyKey) },
          }));
          items = res.Items || [];
        } else {
          const res = await docClient.send(new ScanCommand({ TableName: TABLE_NAME }));
          items = res.Items || [];
        }
      } catch (err) {
        console.warn(`⚠️ DynamoDB Payment scan/query error: ${err.message}`);
        items = Array.from(localStore.values());
      }
    } else {
      items = Array.from(localStore.values());
    }

    const filtered = items.filter((item) => {
      for (const [key, val] of Object.entries(query)) {
        if (item[key] !== val) return false;
      }
      return true;
    });

    return filtered.length > 0 ? formatItem(filtered[0]) : null;
  }
};

module.exports = PaymentModel;
