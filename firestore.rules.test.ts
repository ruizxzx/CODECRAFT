import { assertFails, assertSucceeds, initializeTestEnvironment, RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { readFileSync } from 'fs';

let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'demo-test',
    firestore: {
      rules: readFileSync('firestore.rules', 'utf8'),
    },
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
});

describe('Dirty Dozen Payloads', () => {
  it('1. User Profile Creation with admin role (invalid field)', async () => {
    const db = testEnv.authenticatedContext('alice').firestore();
    await assertFails(db.collection('users').doc('alice').set({
      uid: 'alice',
      username: 'alice123',
      displayName: 'Alice',
      isAdmin: true, // Ghost Field
      createdAt: new Date(),
      updatedAt: new Date()
    }));
  });
  
  it('2. Profile Update spoofing uid', async () => {
    const db = testEnv.authenticatedContext('alice').firestore();
    await assertFails(db.collection('users').doc('alice').update({
      uid: 'bob',
      updatedAt: new Date()
    }));
  });

  it('3. Post Creation with another authorId', async () => {
    const db = testEnv.authenticatedContext('alice').firestore();
    await assertFails(db.collection('posts').doc('post1').set({
      type: 'blog',
      title: 'Hello',
      content: 'World',
      authorId: 'bob',
      authorUsername: 'alice123',
      upvotesCount: 0,
      downvotesCount: 0,
      commentsCount: 0,
      isFeatured: false,
      createdAt: new Date(),
      updatedAt: new Date()
    }));
  });

  it('4. Post Update changing authorId', async () => {
    const db = testEnv.authenticatedContext('alice').firestore();
    await assertFails(db.collection('posts').doc('post1').update({
      authorId: 'bob',
      updatedAt: new Date()
    }));
  });
});

describe('Admin Moderation and Deletion Security Rules', () => {
  const postData = {
    type: 'blog',
    title: 'Test Post',
    content: 'Content',
    authorId: 'bob',
    authorUsername: 'bob123',
    upvotesCount: 0,
    downvotesCount: 0,
    commentsCount: 0,
    isFeatured: false,
    createdAt: new Date(),
    updatedAt: new Date()
  };

  const commentData = {
    postId: 'post1',
    authorId: 'bob',
    authorUsername: 'bob123',
    content: 'Nice post',
    createdAt: new Date(),
    updatedAt: new Date()
  };

  it('Admin (ruizxzxz@gmail.com) deletes another user (bob) post -> MUST succeed', async () => {
    const adminDb = testEnv.authenticatedContext('admin1', { email: 'ruizxzxz@gmail.com' }).firestore();
    const setupDb = testEnv.authenticatedContext('bob', { email: 'bob@example.com' }).firestore();
    await setupDb.collection('posts').doc('post1').set(postData);
    await assertSucceeds(adminDb.collection('posts').doc('post1').delete());
  });

  it('Admin (krishsarkar456@gmail.com) deletes another user (bob) comment -> MUST succeed', async () => {
    const adminDb = testEnv.authenticatedContext('admin2', { email: 'krishsarkar456@gmail.com' }).firestore();
    const setupDb = testEnv.authenticatedContext('bob', { email: 'bob@example.com' }).firestore();
    await setupDb.collection('posts').doc('post1').set(postData);
    await setupDb.collection('posts').doc('post1').collection('comments').doc('c1').set(commentData);
    await assertSucceeds(adminDb.collection('posts').doc('post1').collection('comments').doc('c1').delete());
  });

  it('Admin deletes their own post -> MUST succeed', async () => {
    const adminDb = testEnv.authenticatedContext('admin1', { email: 'ruizxzxz@gmail.com' }).firestore();
    await adminDb.collection('posts').doc('post1').set({ ...postData, authorId: 'admin1' });
    await assertSucceeds(adminDb.collection('posts').doc('post1').delete());
  });

  it('Admin deletes their own comment -> MUST succeed', async () => {
    const adminDb = testEnv.authenticatedContext('admin1', { email: 'ruizxzxz@gmail.com' }).firestore();
    await adminDb.collection('posts').doc('post1').set({ ...postData, authorId: 'admin1' });
    await adminDb.collection('posts').doc('post1').collection('comments').doc('c1').set({ ...commentData, authorId: 'admin1' });
    await assertSucceeds(adminDb.collection('posts').doc('post1').collection('comments').doc('c1').delete());
  });

  it('Normal user (bob) deletes their own post -> MUST succeed', async () => {
    const bobDb = testEnv.authenticatedContext('bob', { email: 'bob@example.com' }).firestore();
    await bobDb.collection('posts').doc('post1').set(postData);
    await assertSucceeds(bobDb.collection('posts').doc('post1').delete());
  });

  it('Normal user (alice) deletes someone else (bob) post -> MUST fail', async () => {
    const bobDb = testEnv.authenticatedContext('bob', { email: 'bob@example.com' }).firestore();
    const aliceDb = testEnv.authenticatedContext('alice', { email: 'alice@example.com' }).firestore();
    await bobDb.collection('posts').doc('post1').set(postData);
    await assertFails(aliceDb.collection('posts').doc('post1').delete());
  });

  it('Normal user (alice) deletes someone else (bob) comment -> MUST fail', async () => {
    const bobDb = testEnv.authenticatedContext('bob', { email: 'bob@example.com' }).firestore();
    const aliceDb = testEnv.authenticatedContext('alice', { email: 'alice@example.com' }).firestore();
    await bobDb.collection('posts').doc('post1').set(postData);
    await bobDb.collection('posts').doc('post1').collection('comments').doc('c1').set(commentData);
    await assertFails(aliceDb.collection('posts').doc('post1').collection('comments').doc('c1').delete());
  });

  it('Unauthenticated user tries to delete post -> MUST fail', async () => {
    const bobDb = testEnv.authenticatedContext('bob', { email: 'bob@example.com' }).firestore();
    const unauthDb = testEnv.unauthenticatedContext().firestore();
    await bobDb.collection('posts').doc('post1').set(postData);
    await assertFails(unauthDb.collection('posts').doc('post1').delete());
  });
});
