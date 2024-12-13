import { Messenger } from "./messenger";
import { SettingsStore } from "./settings";

type KickEvent = {
  event: string;
  data: {
    id: string;
    chatroom_id: string;
    content: string;
    type: string;
    created_at: string;
    sender: {
      id: string;
      username: string;
      slug: string;
      identity: {
        color: string;
        badges: {
          type: string;
          text: string;
        }[];
      };
    };
  };
  channel: string;
};

export class KickMessenger extends Messenger {
  static ChatMessageEvent = "App\\Events\\ChatMessageEvent";

  constructor(protected settings: SettingsStore) {
    super(settings);

    this.addEventListener("onmessage", this.onKickMessage);
    this.addEventListener("onclose", this.onKickClose);
  }

  public async start(roomID: string) {
    const url = this.getURL();

    await this.connect(url);

    const subscribeMessage = {
      event: "pusher:subscribe",
      data: {
        channel: `chatrooms.${roomID}.v2`,
        auth: "",
      },
    };

    try {
      this.send(JSON.stringify(subscribeMessage));
    } catch (error) {
      console.error("error sending message: ", error);
    }
  }

  onKickMessage = (event: any) => {
    try {
      const eventData = JSON.parse(event.data);

      const data = eventData as KickEvent;

      if (data.event == KickMessenger.ChatMessageEvent) {
        eventData.data = JSON.parse(eventData.data);
        const message = data.data.content;
        const senderUsername = data.data.sender.slug;

        // parse the message

        const tokens = this.parse(message);

        this.pushToQueue({
          text: message,
          username: senderUsername,
          tokens,
        });
      } else if (data.event === "pusher:error") {
        const errorMessage = (data.data as any).message;
        throw new Error(errorMessage);
      }
    } catch (error) {
      console.error(error);
    }
  };

  onKickClose = async () =>
    setTimeout(() => {
      this.start(this.settings.get("roomId"));
    }, 2000);

  public parse(message: string) {
    // parse into tokens

    message.trim();

    return message.split(" ").filter((token) => token.length);
  }

  private getURL() {
    const clusterID = this.settings.get("clusterID");
    const version = this.settings.get("version");

    return `wss://ws-us2.pusher.com/app/${clusterID}?protocol=7&client=js&version=${version}&flash=false`;
  }
}
