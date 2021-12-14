export interface Metric {
  comments?: number;
  upvotes: number;
  downvotes: number;
  discussions?: number;
  debates?: number;
}

export interface UserMetric {
  totalPosts: number;
  totalExperiences: number;
  totalKudos: number;
  totalFriends: number;
  totalActivity?: number;
}
