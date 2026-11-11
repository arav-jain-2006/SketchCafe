import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { field, requireValue } from './rules.js';

// Store only token digests. A copied session table cannot be used to replay the original cookies.
const digest = token => createHash('sha256').update(token).digest('hex');
const publicFields = 'id,username,role,active';

// Give every password its own salt, including accounts that use identical passwords.
function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  return salt + ':' + scryptSync(password, salt, 64).toString('hex');
}

// Decode the stored salt and compare the derived bytes without an early mismatch exit.
function matches(password, hash) {
  const [salt, expected] = hash.split(':');
  return timingSafeEqual(scryptSync(password, salt, 64), Buffer.from(expected, 'hex'));
}

// Derive a password hash even for unknown accounts to reduce timing differences.
const fallback = hashPassword('unused dummy password');
// Check usable length without trimming the password that will be hashed.
const validatePassword = value => {
  requireValue(typeof value === 'string' && value.trim().length >= 10 && value.length <= 128,
    'Password must have at least 10 non-padding characters and at most 128 characters.');
  return value;
};

/**
 * Own employee credentials and sessions. The HTTP adapter puts the raw token
 * in a cookie. This service stores its digest and the last active time in milliseconds.
 */
export function createAuth(db, time = Date.now, idle = 30 * 60 * 1000) {
  // Return only fields safe to expose to the UI.
  function account(id) {
    return db.get('SELECT ' + publicFields + ' FROM employees WHERE id=?', id);
  }
  // Check current account state on every protected request and refresh the idle deadline.
  function user(token) {
    if (!token) return null;
    const key = digest(token);
    const session = db.get(`SELECT e.id,e.username,e.role,e.active,s.last_seen FROM sessions s
      JOIN employees e ON s.employee_id=e.id WHERE s.token_hash=?`, key);
    if (!session) return null;
    if (!session.active || time() - session.last_seen >= idle) {
      db.run('DELETE FROM sessions WHERE token_hash=?', key);
      return null;
    }
    db.run('UPDATE sessions SET last_seen=? WHERE token_hash=?', time(), key);
    return account(session.id);
  }

  // Check syntax and uniqueness while excluding the account being edited.
  function usernameFor(value, id = 0) {
    const username = field(value, 'Username', 40, 3);
    requireValue(/^[a-z0-9_.-]+$/i.test(username), 'Use letters, numbers, dots, hyphens or underscores.');
    requireValue(!db.get('SELECT 1 FROM employees WHERE username=? AND id!=?', username, id),
      'That username is already in use.', 409);
    return username;
  }

  // Seed can create either role. The admin staff flow always creates staff.
  function createAccount(username, password, role) {
    return account(Number(db.run('INSERT INTO employees(username,password_hash,role) VALUES (?,?,?)',
      usernameFor(username), hashPassword(validatePassword(password)), role).lastInsertRowid));
  }

  return {
    user,
    // Separate missing or expired sessions from valid sessions with insufficient permission.
    requireRole(token, role) {
      const person = user(token);
      requireValue(person, 'Sign in to continue.', 401);
      requireValue(role === 'employee' || person.role === role, 'Your role cannot access this feature.', 403);
      return person;
    },
    createAccount,
    // Verify credentials, prune expired sessions and return a fresh token plus the public account.
    login(data) {
      const username = field(data.username, 'Username', 40);
      const password = typeof data.password === 'string' ? data.password : '';
      requireValue(password.length > 0 && password.length <= 128, 'Enter valid credentials.', 401);
      const row = db.get('SELECT * FROM employees WHERE username=?', username);
      requireValue(matches(password, row?.password_hash ?? fallback) && row?.active,
        'Username or password is incorrect, or the account is inactive.', 401);
      const token = randomBytes(32).toString('base64url');
      db.run('DELETE FROM sessions WHERE last_seen<=?', time() - idle);
      db.run('INSERT INTO sessions VALUES (?,?,?)', digest(token), row.id, time());
      return { token, user: account(row.id) };
    },
    // Revoke only the presented session. Repeating logout is harmless.
    logout(token) {
      if (token) db.run('DELETE FROM sessions WHERE token_hash=?', digest(token));
    },
    // Check the current password, then replace its hash and revoke sessions in the same transaction.
    changePassword(id, current, password) {
      const row = db.get('SELECT password_hash FROM employees WHERE id=?', id);
      requireValue(typeof current === 'string' && current.length <= 128 && matches(current, row.password_hash),
        'Current password is incorrect.', 403);
      const hash = hashPassword(validatePassword(password));
      db.transaction(() => {
        db.run('UPDATE employees SET password_hash=? WHERE id=?', hash, id);
        db.run('DELETE FROM sessions WHERE employee_id=?', id);
      });
    },
    // The staff management list excludes the administrator account.
    staff() {
      return db.all("SELECT " + publicFields + " FROM employees WHERE role='staff' ORDER BY username");
    },
    // No ID means create. An empty edit password preserves the hash. A reset or deactivation revokes sessions.
    saveStaff(id, data) {
      if (!id) return createAccount(data.username, data.password, 'staff');
      requireValue(account(id)?.role === 'staff', 'Staff account could not be found.', 404);
      requireValue(typeof data.active === 'boolean', 'Choose an account status.');
      const username = usernameFor(data.username, id);
      const hash = data.password ? hashPassword(validatePassword(data.password)) : null;
      return db.transaction(() => {
        db.run('UPDATE employees SET username=?,active=?,password_hash=coalesce(?,password_hash) WHERE id=?',
          username, Number(data.active), hash, id);
        if (!data.active || hash) db.run('DELETE FROM sessions WHERE employee_id=?', id);
        return account(id);
      });
    }
  };
}
