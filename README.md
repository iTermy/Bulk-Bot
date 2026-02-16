# Bulk-Bot

A React Native workout tracking app for iOS and Android.

## What it does

Bulk-Bot helps you log workouts, track exercise history, and follow workout templates. It stores your data in Supabase and includes features like personal records tracking, workout streaks, and weight monitoring.

## Features

**Workout logging**
- Log exercises with weight, reps, and sets
- 50+ exercises pre-loaded with muscle group and equipment info
- Rest timer (90 seconds after completing sets)
- Search and filter exercises by muscle group or equipment

**Progress tracking**
- Top 3 personal records calculated automatically
- Workout streak counter with badges
- Total workouts, training time, and volume stats
- Full exercise history

**History**
- Calendar view showing workout dates
- Filter by time period or exercise name
- Review past workout details

**Templates**
- 6 pre-loaded programs (Push/Pull/Legs, Full Body, etc.)
- Create custom templates
- Template metadata: difficulty, frequency, focus areas
- Save completed workouts as templates

**Profile**
- Track body weight with BMI calculation
- Height input (feet/inches)
- Personal info management
- Weight history

## Tech stack

- React Native with Expo
- Expo Router for navigation
- Supabase (PostgreSQL + Auth)
- AsyncStorage for session persistence
- TypeScript

## Setup

1. Clone the repo
```bash
git clone https://github.com/iTermy/Bulk-Bot.git
cd Bulk-Bot
```

2. Install dependencies
```bash
npm install
```

3. Create `.env` file
```
EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

4. Set up Supabase
   - Create a new project
   - Run the database migrations
   - Configure Row Level Security policies
   - Seed the exercise database

5. Start the app
```bash
npx expo start
```

6. Run on device/simulator
   - Scan QR with Expo Go (iOS/Android)
   - Press `i` for iOS simulator
   - Press `a` for Android emulator

## Database structure

Core tables:
- `profiles` - user info (height, weight, birth date)
- `exercises` - exercise library with muscle groups and equipment
- `workouts` - workout sessions (name, date, duration)
- `sets` - individual set data (weight, reps, exercise reference)
- `weight_entries` - weight tracking history
- `workout_templates` - custom and recommended programs
- `template_exercises` - exercises within templates

The database uses Row Level Security so users only access their own data.

## Project structure

```
app/
  (tabs)/
    index.tsx        # Dashboard
    workout.tsx      # Workout logging
    templates.tsx    # Template management
    history.tsx      # Calendar and history
    profile.tsx      # User profile
  _layout.tsx        # Root layout with auth
  login.tsx          # Authentication
lib/
  supabase.ts        # Supabase client
  AuthContext.tsx    # Auth state
  database.ts        # Database functions
```

## License

MIT