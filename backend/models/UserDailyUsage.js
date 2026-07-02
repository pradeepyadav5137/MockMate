const { PutCommand, GetCommand, QueryCommand, ScanCommand } = require('@aws-sdk/lib-dynamodb');
const { docClient, isPlaceholderKey, ddbClient } = require('../config/dynamodb');
const { CreateTableCommand, DescribeTableCommand } = require('@aws-sdk/client-dynamodb');

const TABLE_NAME = process.env.DYNAMODB_USAGE_TABLE || 'MockMate_UserDailyUsage';
const localStore = new Map();

// Auto-create table
(async () => {
  if (!ddbClient) return;
  try {
    await ddbClient.send(new DescribeTableCommand({ TableName: TABLE_NAME }));
  } catch (err) {
    if (err.name === 'ResourceNotFoundException') {
      try {
        await ddbClient.send(new CreateTableCommand({
          TableName: TABLE_NAME,
          KeySchema: [
            { AttributeName: 'userId', KeyType: 'HASH' },
            { AttributeName: 'date', KeyType: 'RANGE' },
          ],
          AttributeDefinitions: [
            { AttributeName: 'userId', AttributeType: 'S' },
            { AttributeName: 'date', AttributeType: 'S' },
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

const UserDailyUsageModel = {
  async findOne({ userId, date }) {
    const uid = String(userId);
    if (docClient && !isPlaceholderKey) {
      try {
        const res = await docClient.send(new GetCommand({
          TableName: TABLE_NAME,
          Key: { userId: uid, date },
        }));
        return res.Item || null;
      } catch (err) {
        console.warn(`⚠️ DynamoDB usage get error: ${err.message}`);
      }
    }
    return localStore.get(`${uid}:${date}`) || null;
  },

  async findOneAndUpdate({ userId, date }, update, options = {}) {
    const uid = String(userId);
    const existing = await this.findOne({ userId: uid, date });
    const item = {
      userId: uid,
      date,
      used: update.used !== undefined ? update.used : (existing?.used || false),
    };
    if (docClient && !isPlaceholderKey) {
      try {
        await docClient.send(new PutCommand({ TableName: TABLE_NAME, Item: item }));
      } catch (err) {
        console.warn(`⚠️ DynamoDB usage put error: ${err.message}`);
        localStore.set(`${uid}:${date}`, item);
      }
    } else {
      localStore.set(`${uid}:${date}`, item);
    }
    return item;
  },
};

module.exports = UserDailyUsageModel;
