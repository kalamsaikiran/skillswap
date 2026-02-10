export interface User {
  _id: string;
  name: string;
  email: string;
  skills: Skill[];
  interests: string[];
  connections: string[];
  rating: number;
  reviews: Review[];
}

export interface Skill {
  name: string;
  proficiency: number;
  completionPercentage: number;
}

export interface Review {
  userId: string;
  rating: number;
  comment: string;
  createdAt: Date;
}

export interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  loading: boolean;
  error: string | null;
}