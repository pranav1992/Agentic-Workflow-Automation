# Git Merge & Deployment Guide

## Current Version Status

### v0.2.0 (Feature Branch)
- **Branch**: feature/production-restructure-v0.2.0
- **Status**: Ready for review and merge
- **Commits**: 2 commits ahead of main
- **Changes**: 28 files, 3,425 insertions

### v0.1.0 (Main Branch)
- **Branch**: main
- **Status**: Current production (legacy)
- **Tag**: v0.1.0

## How to Review Changes

### View all changes
git show v0.2.0

### View specific file changes
git show v0.2.0:AgentServer/app/core/security.py

### Compare branches
git diff main..feature/production-restructure-v0.2.0

## Merging to Main (When Ready)

### 1. Update main branch
git checkout main
git pull origin main

### 2. Merge feature branch
git merge feature/production-restructure-v0.2.0 --no-ff -m "Merge v0.2.0: Production-grade multi-tenant restructure"

### 3. Push to remote
git push origin main
git push origin v0.2.0  # Push the tag

## Release Workflow

### Before Merging to Main
- [ ] Review ARCHITECTURE.md
- [ ] Review MIGRATION_GUIDE.md
- [ ] Run tests: pytest tests/ -v
- [ ] Test in staging environment
- [ ] Review breaking changes
- [ ] Update frontend integration

### After Merging to Main
- [ ] Run full test suite
- [ ] Deploy to staging
- [ ] Verify health checks
- [ ] Run smoke tests
- [ ] Deploy to production (if approved)
- [ ] Monitor logs and metrics

## Creating Release Notes

### From main
git log v0.1.0..v0.2.0 --pretty=format:"%h - %s" > RELEASE_NOTES.txt

## Rollback Procedure

If issues occur after deployment:

### Option 1: Revert merge commit (creates new commit)
git revert -m 1 <merge-commit-hash>
git push origin main

### Option 2: Reset to v0.1.0 (use with caution)
git reset --hard v0.1.0
git push -f origin main

### Option 3: Checkout specific commit
git checkout v0.1.0
git push -f origin main

## Version Tags Reference

List all tags with dates:
git log --tags --simplify-by-decoration --pretty="format:%d %ai"

Checkout specific version:
git checkout v0.2.0

Delete tag locally (if needed):
git tag -d v0.2.0

Delete tag from remote:
git push origin --delete v0.2.0

## Branch Management

List all branches:
git branch -a

Delete feature branch after merge:
git branch -d feature/production-restructure-v0.2.0

Force delete (if not merged):
git branch -D feature/production-restructure-v0.2.0

## Continuous Integration Ready

The repository is now set up for:
- ✅ Version tagging (v0.1.0, v0.2.0, etc.)
- ✅ Branch-based workflow
- ✅ Semantic commits (feat:, refactor:, docs:, etc.)
- ✅ Release notes generation
- ✅ Rollback procedures
- ✅ CI/CD integration

## Next Steps

1. **Review the changes**:
   git show v0.2.0

2. **Test in staging**:
   - Deploy feature branch to staging
   - Run full test suite
   - Verify all features

3. **Merge to main** (when approved):
   git checkout main && git merge feature/production-restructure-v0.2.0

4. **Tag release**:
   git push origin v0.2.0

5. **Deploy to production**:
   - Follow your deployment process
   - Monitor health checks
   - Watch for errors
