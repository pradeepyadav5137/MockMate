const dynamoUserService = require('../services/dynamoUserService');

// Helper wrapper to support chainable .select() and helper functions
function wrapUserQuery(promise) {
  const queryObj = promise.then((user) => {
    if (!user) return null;
    return user;
  });
  queryObj.select = function (fields) {
    return promise.then((user) => {
      if (!user) return null;
      if (typeof fields === 'string') {
        const fieldList = fields.split(' ');
        const sanitized = { ...user };
        fieldList.forEach((f) => {
          if (f.startsWith('-')) {
            delete sanitized[f.substring(1)];
          }
        });
        return sanitized;
      }
      return user;
    });
  };
  return queryObj;
}

const UserModel = {
  async create(data) {
    return dynamoUserService.createUser(data);
  },

  findById(id) {
    return wrapUserQuery(dynamoUserService.findUserById(id));
  },

  findOne(query) {
    if (!query) return wrapUserQuery(Promise.resolve(null));

    if (query.email) {
      return wrapUserQuery(dynamoUserService.findUserByEmail(query.email));
    }
    if (query.googleId) {
      return wrapUserQuery(dynamoUserService.findUserByField('googleId', query.googleId));
    }
    if (query.verificationToken) {
      return wrapUserQuery(dynamoUserService.findUserByField('verificationToken', query.verificationToken));
    }
    if (query.resetPasswordToken) {
      return wrapUserQuery(dynamoUserService.findUserByField('resetPasswordToken', query.resetPasswordToken));
    }
    if (query.$or) {
      const emailObj = query.$or.find((item) => item.email);
      if (emailObj) return wrapUserQuery(dynamoUserService.findUserByEmail(emailObj.email));
      const googleObj = query.$or.find((item) => item.googleId);
      if (googleObj) return wrapUserQuery(dynamoUserService.findUserByField('googleId', googleObj.googleId));
    }

    return wrapUserQuery(Promise.resolve(null));
  },

  findByIdAndUpdate(id, updateData, options = {}) {
    const updatePayload = updateData.$set ? updateData.$set : updateData;
    return wrapUserQuery(dynamoUserService.updateUser(id, updatePayload));
  },

  async countDocuments() {
    return 1;
  },
};

module.exports = UserModel;
