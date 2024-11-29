import { MessageType } from "./message-parser";
import { SettingsStore } from "./settings";

enum Roles {
  User,
  Admin,
  SuperAdmin,
}

export class Authorizer {
  list = new Map<MessageType, Roles>([
    [MessageType.TTS, Roles.User],

    [MessageType.video, Roles.Admin],
    [MessageType.bit, Roles.Admin],
    [MessageType.bitVol, Roles.Admin],
    [MessageType.skip, Roles.Admin],
    [MessageType.vol, Roles.Admin],
    [MessageType.addBit, Roles.Admin],
    [MessageType.removeBit, Roles.Admin],

    [MessageType.addAdmin, Roles.SuperAdmin],
    [MessageType.removeAdmin, Roles.SuperAdmin],
    [MessageType.config, Roles.SuperAdmin],
    [MessageType.clearConfig, Roles.SuperAdmin],
  ]);

  constructor(private settings: SettingsStore) {}

  public isAuthorized(username: string, command: MessageType) {
    return (this.list.get(command) ?? 0) <= this.whoami(username);
  }

  whoami(username: string) {
    if (this.settings.get("superadmins").has(username)) {
      return 2;
    }

    if (this.settings.get("admins").has(username)) {
      return 1;
    }

    return 0;
  }
}