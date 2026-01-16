export interface FriendInfo {
  name: string;
  description: string;
  avatar: string;
  url: string;
}

export const friends: FriendInfo[] = [
  {
    name: 'Larry',
    description: "who's observing the universe",
    avatar: 'https://avatars.githubusercontent.com/u/13360148?v=4',
    url: 'https://universe.observer/',
  }
];
