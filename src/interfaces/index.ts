export interface ESRBData {
  title: string;
  ratingCategory: string;
  descriptors: string[];
  interactiveElements: string[];
  platforms?: string;
  esrbId?: number;
  esrbUrl?: string;
}
