export interface Metric {
  upvotes: number;
  downvotes: number;
  discussions?: number;
  debates?: number;
  comments?: number;
  tips?: number;
}

export interface UserMetric {
  totalPosts: number;
  totalExperiences: number;
  totalKudos: number;
  totalFriends: number;
  totalActivity?: number;
}
