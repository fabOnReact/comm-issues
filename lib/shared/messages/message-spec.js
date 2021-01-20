// @flow

import type { PlatformDetails } from '../../types/device-types';
import type { Media } from '../../types/media-types';
import type {
  MessageInfo,
  RawComposableMessageInfo,
  RawMessageInfo,
  RawRobotextMessageInfo,
} from '../../types/message-types';
import type { RawUnsupportedMessageInfo } from '../../types/message/unsupported';
import type { ThreadInfo } from '../../types/thread-types';
import type { RelativeUserInfo } from '../../types/user-types';

export type MessageSpec<Data, RawInfo, Info> = {|
  +messageContent?: (data: Data) => string | null,
  +rawMessageInfoFromRow?: (
    row: Object,
    params: {|
      +localID: string,
      +media?: $ReadOnlyArray<Media>,
      +derivedMessages: $ReadOnlyMap<
        string,
        RawComposableMessageInfo | RawRobotextMessageInfo,
      >,
    |},
  ) => ?RawInfo,
  +createMessageInfo: (
    rawMessageInfo: RawInfo,
    creator: RelativeUserInfo,
    params: {|
      +threadInfos: {| [id: string]: ThreadInfo |},
      +createMessageInfoFromRaw: (rawInfo: RawMessageInfo) => MessageInfo,
      +createRelativeUserInfos: (
        userIDs: $ReadOnlyArray<string>,
      ) => RelativeUserInfo[],
    |},
  ) => ?Info,
  +rawMessageInfoFromMessageData?: (messageData: Data, id: string) => RawInfo,
  +robotext?: (
    messageInfo: Info,
    creator: string,
    params: {|
      +encodedThreadEntity: (threadID: string, text: string) => string,
      +robotextForUsers: (users: RelativeUserInfo[]) => string,
      +robotextForUser: (user: RelativeUserInfo) => string,
      +threadInfo: ThreadInfo,
    |},
  ) => string,
  +shimUnsupportedMessageInfo?: (
    rawMessageInfo: RawInfo,
    platformDetails: ?PlatformDetails,
  ) => RawInfo | RawUnsupportedMessageInfo,
|};