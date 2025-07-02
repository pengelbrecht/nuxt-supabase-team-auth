# Changelog

All notable changes to this project will be documented in this file.

## [0.4.0] - 2025-07-02

### 🎉 First Stable Release

This is the first stable release of `nuxt-supabase-team-auth` with all critical bugs resolved.

### 🐛 Bug Fixes

- **Fixed Team Members dialog not opening from UserButton dropdown** - Resolved component unmounting issue during loading states
- **Fixed authentication state management** - Prevents UI from unmounting during data loading operations
- **Stabilized dialog/modal system** - All dialogs now work consistently across the application

### ✨ Features

- Complete team-based authentication system for Nuxt 3
- Supabase integration with RLS policies
- Role-based access control (owner, admin, member, super_admin)
- Team management UI components
- User profile management
- Team invitations system
- Impersonation support for super admins
- CLI tool for database setup and migrations
- Full TypeScript support

### 🔧 Technical Improvements

- Comprehensive test suite with 126+ tests
- Proper error handling throughout
- Consistent component patterns
- Clean module architecture
- Extensive documentation in CLAUDE.md

### 📝 Notes

All previous versions (0.1.x - 0.3.x) were development/debug releases and should not be used in production.