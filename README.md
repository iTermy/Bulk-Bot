# Workout Tracker App 💪

A comprehensive mobile workout tracking application built with React Native and Expo, featuring advanced workout logging, progress analytics, and professional workout templates.

![Project Status](https://img.shields.io/badge/Status-Phase%203%20Complete-success)
![Platform](https://img.shields.io/badge/Platform-iOS%20%7C%20Android-blue)
![License](https://img.shields.io/badge/License-MIT-green)

## 🎯 Overview

Workout Tracker is a feature-rich mobile app designed to help fitness enthusiasts log workouts, track progress, and follow professional workout programs. Similar to MacroFactor but for strength training, it provides an intuitive interface for exercise tracking with comprehensive analytics and template management.

## ✨ Key Features

### 🏋️ Workout Logging
- **Complete Exercise Tracking**: Log weight, reps, and sets for any exercise
- **50+ Exercise Database**: Pre-loaded exercises with muscle groups and equipment info
- **Smart Rest Timer**: Automatic 90-second countdown after completing sets
- **Exercise Picker**: Advanced search and filtering by muscle group and equipment
- **Custom Workouts**: Name your workouts and add notes

### 📊 Progress Tracking
- **Personal Records**: Track your top 3 PRs automatically calculated across all workouts
- **Animal Streak Badges**: Earn unique animal emojis (🐭 to 🐲) as you build workout consistency (30+ days)
- **Statistics Dashboard**: View total workouts, training time, and volume lifted
- **Exercise History**: Complete history of every exercise with progress over time

### 📅 History & Calendar
- **Visual Calendar**: See workout completion dots on calendar dates
- **Smart Filters**: Filter by time period (week, month, year) or search by exercise name
- **Detailed Workout View**: Review every set, rep, and weight from past workouts
- **Workout Statistics**: Track volume, duration, and exercise variety

### 📋 Template System
- **Professional Templates**: 6 pre-loaded workout programs (Push Day, Pull Day, Full Body, etc.)
- **Custom Templates**: Create your own templates with metadata (difficulty, frequency, focus areas)
- **Smart Metadata**: Auto-detection of muscle groups and exercise difficulty
- **Quick Load**: One-tap template loading with customization options
- **Template Library**: Organize with favorites and search functionality

### 👤 Profile Management
- **Body Metrics**: Track weight with BMI calculation and visual history
- **Height System**: US-based feet/inches input system
- **Personal Info**: Manage name, birth date, and age calculation
- **Weight Trends**: View your last 5 weight entries with deletion support

## 🛠️ Technology Stack

- **Frontend**: React Native with Expo SDK 49+
- **Navigation**: Expo Router (file-based routing)
- **Backend**: Supabase (PostgreSQL database + Authentication)
- **State Management**: React Context API
- **Storage**: AsyncStorage for session persistence
- **Icons**: @expo/vector-icons

## 📱 Screenshots

> *Add screenshots here showcasing: Home Dashboard, Workout Logging, History Calendar, Template Library, Profile*

## 🚀 Getting Started

### Prerequisites

```bash
# Node.js (v18 or higher)
# npm or yarn
# Expo CLI
npm install -g expo-cli
```

### Installation

1. **Clone the repository**
```bash
git clone https://github.com/yourusername/workout-tracker.git
cd workout-tracker
```

2. **Install dependencies**
```bash
npm install
```

3. **Set up environment variables**

Create a `.env` file in the root directory:

```env
EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

4. **Set up Supabase**

- Create a new Supabase project
- Run the database migrations (see [Database Setup](#database-setup))
- Configure Row Level Security (RLS) policies
- Seed the exercise database

5. **Start the development server**
```bash
npx expo start
```

6. **Run on your device**
- Scan the QR code with Expo Go app (iOS/Android)
- Or press `i` for iOS simulator, `a` for Android emulator

## 🗄️ Database Setup

The app uses Supabase with the following core tables:

### Core Tables
- **profiles**: User information (height, weight, birth date)
- **exercises**: 50+ exercises with muscle groups and equipment
- **workouts**: Workout sessions with name, date, and duration
- **sets**: Individual set data (weight, reps, exercise reference)
- **weight_entries**: Historical weight tracking

### Template Tables
- **workout_templates**: Custom and recommended workout programs
- **template_exercises**: Exercise lists within templates

### Key Features
- **Row Level Security**: Users can only access their own data
- **Recommended Templates**: Shared professional workout programs
- **Metadata Support**: Difficulty levels, frequency tags, and focus areas

See the project documentation for the complete schema and setup instructions.

## 📖 Usage

### Creating Your First Workout

1. Navigate to the **Workout** tab
2. Tap "Add Exercise" to select exercises
3. Log your sets with weight and reps
4. Complete sets turn green with a checkmark
5. Tap "Save Workout" when finished

### Using Templates

1. Go to the **Templates** tab
2. Browse recommended templates or create your own
3. Tap a template to view details
4. Add to your collection or load directly into a workout
5. Customize as needed before starting

### Tracking Progress

1. View your **Home** dashboard for quick stats
2. Check your top 3 personal records
3. Monitor your workout streak with animal badges
4. Tap recent workouts to view full details

## 🏗️ Project Structure

```
WorkoutTracker/
├── app/                      # Expo Router app directory
│   ├── (tabs)/              # Tab navigation screens
│   │   ├── index.tsx        # Home/Dashboard
│   │   ├── workout.tsx      # Workout logging
│   │   ├── templates.tsx    # Template management
│   │   ├── history.tsx      # Workout history
│   │   └── profile.tsx      # User profile
│   ├── _layout.tsx          # Root layout with auth
│   └── login.tsx            # Authentication screen
├── lib/                      # Core utilities
│   ├── supabase.ts          # Supabase client
│   ├── AuthContext.tsx      # Auth state management
│   └── database.ts          # Database service functions
└── assets/                   # Images and fonts
```

## 🎨 Design System

### Color Palette
- **Primary**: #007AFF (iOS blue)
- **Success**: #34C759 (green)
- **Danger**: #FF3B30 (red)
- **Background**: #f5f5f5
- **Card**: white with subtle shadow

### UI Patterns
- **Full-screen modals** for complex forms
- **Popup modals** (85% height, 90% width) for details
- **Pill badges** for metadata and filters
- **Card-based layouts** with consistent spacing
- **Touchable feedback** with opacity changes

## 🔐 Authentication

The app uses Supabase Authentication with:
- Email/password sign up and login
- Session persistence across app restarts
- Automatic token refresh
- Protected routes with auth guards

## 📊 Features Roadmap

### ✅ Phase 1-3 Complete
- Core workout logging
- History with calendar
- Profile and weight tracking
- Template system with metadata
- Personal records and streaks

### 🚧 Phase 4 (In Progress)
- [ ] Template loading in workout screen
- [ ] Save completed workouts as templates
- [ ] Enhanced exercise picker in workout mode

### 🔮 Future Enhancements
- Advanced analytics and charts
- Exercise images and form guides
- Social features (sharing, challenges)
- Custom exercise creation
- Cloud backup and export
- Offline mode with sync

## 🐛 Known Issues

All critical bugs have been resolved in Phase 3, including:
- ✅ Timezone handling in calendar
- ✅ Height input system (US feet/inches)
- ✅ Modal consistency and transitions
- ✅ Template metadata preservation
- ✅ Calendar layout optimization

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request. For major changes, please open an issue first to discuss what you would like to change.

### Development Guidelines
- Follow the existing code style and patterns
- Use TypeScript for type safety
- Test on both iOS and Android
- Update documentation for new features
- Ensure proper error handling

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 👨‍💻 Author

Created with 💪 by [Your Name]

## 🙏 Acknowledgments

- Exercise database inspired by fitness industry standards
- UI/UX patterns following iOS Human Interface Guidelines
- Community feedback and testing

## 📞 Support

For support, email your.email@example.com or open an issue in the GitHub repository.

---

**Built with React Native, Expo, and Supabase** | **Last Updated: November 2025**