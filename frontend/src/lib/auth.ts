// Clears the session cookie server-side. Caller is responsible for
// navigating away (e.g. to /Login) afterward.
export async function logout(): Promise<void> {
    await fetch('http://localhost:5000/logout', {
        method: 'POST',
        credentials: 'include',
    });
}
