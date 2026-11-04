// fontsource() looks for @fontsource packages from the working directory, as in a user's
// project. Tests may be started from the workspace root, so run them from this package.
process.chdir(import.meta.dirname);
