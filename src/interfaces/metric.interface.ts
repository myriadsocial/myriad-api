// TODO: removed likes, comments and dislikes
export interface Metric {
  likes?: number;
  dislikes?: number;
  comments?: number;
  upvotes: number;
  downvotes: number;
  discussions?: number;
  debates?: number;
  shares?: number;
}

export interface UserMetric {
  totalPosts: number;
  totalExperiences: number;
  totalKudos: number;
  totalFriends: number;
}
