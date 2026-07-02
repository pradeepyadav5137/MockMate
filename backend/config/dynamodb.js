const { DynamoDBClient, CreateTableCommand, DescribeTableCommand } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');

const region = process.env.AWS_REGION || 'ap-south-1';
const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

const isPlaceholderKey = !accessKeyId || !secretAccessKey || accessKeyId.includes('EXAMPLE') || secretAccessKey.includes('EXAMPLE');

let ddbClient = null;
let docClient = null;

if (!isPlaceholderKey) {
  try {
    ddbClient = new DynamoDBClient({
      region,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });
    docClient = DynamoDBDocumentClient.from(ddbClient, {
      marshallOptions: { removeUndefinedValues: true },
    });
    console.log(`⚡ AWS DynamoDB Client initialized for region ${region}`);
  } catch (err) {
    console.warn(`⚠️ DynamoDB client initialization error: ${err.message}`);
  }
} else {
  console.warn(`⚠️ AWS credentials contain example placeholders or are missing. Local DynamoDB fallback store will be used.`);
}

const TABLE_NAME = process.env.DYNAMODB_USER_TABLE || 'MockMate_Users';

const initTable = async () => {
  if (!ddbClient) return false;
  try {
    await ddbClient.send(new DescribeTableCommand({ TableName: TABLE_NAME }));
    console.log(`✅ DynamoDB table "${TABLE_NAME}" exists and is ready.`);
    return true;
  } catch (err) {
    if (err.name === 'ResourceNotFoundException') {
      console.log(`⏳ Table "${TABLE_NAME}" not found. Creating table on DynamoDB...`);
      try {
        await ddbClient.send(
          new CreateTableCommand({
            TableName: TABLE_NAME,
            KeySchema: [{ AttributeName: 'id', KeyType: 'HASH' }],
            AttributeDefinitions: [
              { AttributeName: 'id', AttributeType: 'S' },
              { AttributeName: 'email', AttributeType: 'S' },
            ],
            GlobalSecondaryIndexes: [
              {
                IndexName: 'EmailIndex',
                KeySchema: [{ AttributeName: 'email', KeyType: 'HASH' }],
                Projection: { ProjectionType: 'ALL' },
                ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 },
              },
            ],
            ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 },
          })
        );
        console.log(`✅ DynamoDB table "${TABLE_NAME}" created successfully.`);
        return true;
      } catch (createErr) {
        console.error(`❌ Failed to create DynamoDB table: ${createErr.message}`);
        return false;
      }
    } else {
      console.warn(`⚠️ DynamoDB describe table error: ${err.message}`);
      return false;
    }
  }
};

module.exports = {
  ddbClient,
  docClient,
  TABLE_NAME,
  initTable,
  isPlaceholderKey,
};
