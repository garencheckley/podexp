import { Firestore } from '@google-cloud/firestore';

const firestore = new Firestore({
  projectId: process.env.GOOGLE_CLOUD_PROJECT || 'gcpg-452703',
  // When running locally, you'll need to set GOOGLE_APPLICATION_CREDENTIALS
  // When running in Cloud Run, the service account will be automatically used
});

export default firestore; 