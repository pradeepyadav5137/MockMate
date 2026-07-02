const { PutCommand, GetCommand, QueryCommand, ScanCommand, UpdateCommand, DeleteCommand } = require('@aws-sdk/lib-dynamodb');
const { docClient, TABLE_NAME, isPlaceholderKey } = require('../config/dynamodb');
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');

// Fallback in-memory store for development if AWS credentials are placeholder/offline
const localUserStore = new Map();

// Helper to convert user object and add comparePassword method
const formatUserObject = (item) => {
  if (!item) return null;
  const userObj = { ...item, _id: item.id || item._id };
  userObj.comparePassword = async function (candidatePassword) {
    if (!this.password) return false;
    return bcrypt.compare(candidatePassword, this.password);
  };
  userObj.save = async function () {
    return dynamoUserService.updateUser(this.id || this._id, this);
  };
  return userObj;
};

const dynamoUserService = {
  async createUser(data) {
    const userId = data.id || data._id || `usr_${uuidv4().replace(/-/g, '')}`;
    const now = new Date().toISOString();
    const newUser = {
      id: userId,
      _id: userId,
      name: data.name || '',
      email: String(data.email || '').toLowerCase().trim(),
      password: data.password || '',
      googleId: data.googleId || null,
      avatar: data.avatar || null,
      isVerified: Boolean(data.isVerified),
      verificationToken: data.verificationToken || null,
      verificationTokenExpires: data.verificationTokenExpires ? new Date(data.verificationTokenExpires).toISOString() : null,
      resetPasswordToken: data.resetPasswordToken || null,
      resetPasswordExpires: data.resetPasswordExpires ? new Date(data.resetPasswordExpires).toISOString() : null,
      resumeText: data.resumeText || '',
      resumeProfile: data.resumeProfile || { skills: [], technologies: [], projects: [], experience: [], education: [], summary: '' },
      createdAt: data.createdAt ? new Date(data.createdAt).toISOString() : now,
    };

    if (docClient && !isPlaceholderKey) {
      try {
        await docClient.send(
          new PutCommand({
            TableName: TABLE_NAME,
            Item: newUser,
          })
        );
        console.log(`⚡ Saved user ${newUser.email} to AWS DynamoDB.`);
      } catch (err) {
        console.warn(`⚠️ DynamoDB PutCommand failed (${err.message}). Storing in local memory fallback.`);
        localUserStore.set(userId, newUser);
      }
    } else {
      localUserStore.set(userId, newUser);
      console.log(`ℹ️ Saved user ${newUser.email} to local user store.`);
    }

    return formatUserObject(newUser);
  },

  async findUserById(id) {
    if (!id) return null;
    const searchId = String(id);
    if (docClient && !isPlaceholderKey) {
      try {
        const res = await docClient.send(
          new GetCommand({
            TableName: TABLE_NAME,
            Key: { id: searchId },
          })
        );
        if (res.Item) return formatUserObject(res.Item);
      } catch (err) {
        console.warn(`⚠️ DynamoDB GetCommand error: ${err.message}`);
      }
    }
    const local = localUserStore.get(searchId);
    return local ? formatUserObject(local) : null;
  },

  async findUserByEmail(email) {
    if (!email) return null;
    const normEmail = String(email).toLowerCase().trim();
    if (docClient && !isPlaceholderKey) {
      try {
        // Try Query on EmailIndex GSI
        const res = await docClient.send(
          new QueryCommand({
            TableName: TABLE_NAME,
            IndexName: 'EmailIndex',
            KeyConditionExpression: 'email = :email',
            ExpressionAttributeValues: { ':email': normEmail },
          })
        );
        if (res.Items && res.Items.length > 0) {
          return formatUserObject(res.Items[0]);
        }
      } catch (err) {
        // Fallback to Scan if GSI is not indexed yet
        try {
          const scanRes = await docClient.send(
            new ScanCommand({
              TableName: TABLE_NAME,
              FilterExpression: 'email = :email',
              ExpressionAttributeValues: { ':email': normEmail },
            })
          );
          if (scanRes.Items && scanRes.Items.length > 0) {
            return formatUserObject(scanRes.Items[0]);
          }
        } catch (scanErr) {
          console.warn(`⚠️ DynamoDB Scan error by email: ${scanErr.message}`);
        }
      }
    }

    // Local fallback search
    for (const u of localUserStore.values()) {
      if (u.email === normEmail) return formatUserObject(u);
    }
    return null;
  },

  async findUserByField(field, value) {
    if (!value) return null;
    if (docClient && !isPlaceholderKey) {
      try {
        const res = await docClient.send(
          new ScanCommand({
            TableName: TABLE_NAME,
            FilterExpression: `#f = :v`,
            ExpressionAttributeNames: { '#f': field },
            ExpressionAttributeValues: { ':v': value },
          })
        );
        if (res.Items && res.Items.length > 0) {
          return formatUserObject(res.Items[0]);
        }
      } catch (err) {
        console.warn(`⚠️ DynamoDB Scan error for field ${field}: ${err.message}`);
      }
    }

    for (const u of localUserStore.values()) {
      if (u[field] === value) return formatUserObject(u);
    }
    return null;
  },

  async updateUser(id, updateData) {
    const existing = await this.findUserById(id);
    if (!existing) return null;

    const updated = {
      ...existing,
      ...updateData,
      id: existing.id,
      _id: existing._id,
    };
    // Remove functions before persisting
    delete updated.comparePassword;
    delete updated.save;
    delete updated.toObject;

    // Sanitize: convert Date objects to ISO strings, undefined to null
    for (const key of Object.keys(updated)) {
      if (updated[key] instanceof Date) {
        updated[key] = updated[key].toISOString();
      } else if (updated[key] === undefined) {
        updated[key] = null;
      }
    }

    if (docClient && !isPlaceholderKey) {
      try {
        await docClient.send(
          new PutCommand({
            TableName: TABLE_NAME,
            Item: updated,
          })
        );
      } catch (err) {
        console.warn(`⚠️ DynamoDB update error: ${err.message}`);
        localUserStore.set(existing.id, updated);
      }
    } else {
      localUserStore.set(existing.id, updated);
    }

    return formatUserObject(updated);
  },
};

module.exports = dynamoUserService;
