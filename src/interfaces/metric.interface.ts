export interface Metric {
  upvotes: number;
  downvotes: number;
  discussions?: number;
  debates?: number;
  comments?: number;
  deletedComments?: number; // total deleted comment by user
  tips?: number;
}

export interface UserMetric {
  totalComments: number;
  totalPosts: number;
  totalExperiences: number;
  totalSubscriptions: number;
  totalKudos: number;
  totalFriends: number;
  totalTransactions: number;
  totalActivity?: number;
}

export interface ServerMetric {
  totalComments: number;
  totalPosts: DetailTotalPost;
  totalUsers: number;
  totalVotes: number;
  totalTransactions: number;
  totalExperiences: number;
  totalSubscriptions: number;
}

export interface DetailTotalPost {
  totalReddit: number;
  totalTwitter: number;
  totalMyriad: number;
  totalAll: number;
}
