'use strict';

const _ = require('lodash');
const fs = require('fs').promises;

class Permissions {
  async setup() {
    if (!strapi.isLoaded) {
      setTimeout(() => {
        this.setup();
      }, 200);
      return;
    }

    if (!strapi.config.permissions) {
      strapi.log.info('[Permissions] 🚀 Creating permissions file...');
      await this.createPermissionsFile();

      // Strapi is now auto restarting... if not, schedule a 'kill'
      setTimeout(() => {
        strapi.log.info('[Permissions] 🚀 Created config/permissions.js. Please restart Strapi manually.');
        process.exit(1);
      }, 200);
    }

    strapi.log.info('[Permissions] 🚀 Setting up permissions...');

    const roles = await strapi.plugin('users-permissions').service('role').getRoles();
    for (let role of roles) {
      if (!role || role.id === null) {
        continue;
      }

      role = await strapi.plugin('users-permissions').service('role').getRole(role.id, []);

      const existingPermissionKeys = Object.keys(role.permissions);
      for (const permissionKey of existingPermissionKeys) {
        const controllers = _.values(role.permissions[permissionKey].controllers);
        for (const controller of controllers) {
          const controllerKeys = Object.keys(controller);
          for (const controllerKey of controllerKeys) {
            _.set(controller, `${controllerKey}.enabled`, false);
          }
        }
      }

      const permissionConfig = _.get(strapi.config.permissions, role.type, null) || null;
      if (!permissionConfig) {
        continue;
      }

      const permissionKeys = Object.keys(permissionConfig);
      for (const permissionKey of permissionKeys) {
        const keyParts = permissionKey.split('.');
        const key = _.head(keyParts) || permissionKey;

        const controllers = [];
        if (keyParts.length > 1) {
          controllers.push(role.permissions[key].controllers[keyParts[1]]);
        } else {
          controllers.push(role.permissions[key].controllers);
        }

        for (const controller of controllers) {
          for (const permission of permissionConfig[permissionKey]) {
            if (_.has(controller, permission)) {
              _.set(controller, `${permission}.enabled`, true);
            }
          }
        }
      }

      await strapi.plugin('users-permissions').service('role').updateRole(role.id, role);
    }

    strapi.log.info('[Permissions] 🚀 All permissions set.');
  }

  async createPermissionsFile() {
    const targetFilename = `${strapi.dirs.config}/permissions.js`;

    try {
      await fs.stat(targetFilename);
    } catch (e) {
      if (e.code !== 'ENOENT') {
        return;
      }

      await fs.copyFile(`${__dirname}/default-config.js`, targetFilename);
    }
  }
}

module.exports = Permissions;