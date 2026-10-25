# Circular Resource Intelligence Platform — new GitHub Pages build

This is a fresh implementation of the site interface and modules. The original approved research dataset was preserved as `data.json` without changing values. It does **not** reuse the legacy `app.js`, `beta-auth.js`, `supabase-config.js`, or Netlify configuration.

## Deploy
1. Open your GitHub repository > Add file > Upload files.
2. Extract the ZIP first. Upload **all files inside** the ZIP into the repository root (not the ZIP itself).
3. Commit changes.
4. Settings > Pages > Build and deployment > Deploy from a branch > main > /(root) > Save.
5. Wait for the published github.io link.

## Firebase — required setup
- Firebase Authentication: enable Email/Password and Google.
- Authentication > Settings > Authorized domains: add `parshvvikotharie00-cpu.github.io` (and any future custom domain).
- Firestore: create the default database and paste `firestore.rules` into Firestore > Rules > Publish.
- The web Firebase identifiers are in `firebase-config.js` based on the screenshot provided. Check these against your console before launch.
- Test new email signup, returning login, Google signup, all four roles, restricted Action Center, and dataset export.

## Important limitations
- CSV is generated from publicly accessible `data.json`. Login gates the **export button**, not underlying public data. Genuine access control for confidential datasets requires server-side authenticated endpoints or secured storage.
- Role restrictions in the UI are user-experience gates; backend protection of Action Center operations requires server-side verification.
- Google first-time signup uses browser prompts for name/role. This is a functional but basic onboarding UI.
- The GIS shows approximate state centres and not validated facility coordinates.
- Contact directory is inherited from supplied project data and is not independently verified.
- This is a new functional implementation, not a pixel-identical audited recreation of every old behavior. Validate it against the original before retiring that deployment.
- Never commit Firebase service-account JSON, private keys, or other secrets.
