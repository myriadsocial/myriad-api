export interface Asset {
  images: Sizes[] | string[];
  videos: string[];
}

export interface Sizes {
  original: string;
  thumbnail: string;
  small: string;
  medium: string;
  large: string;
}
