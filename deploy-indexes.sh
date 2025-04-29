#!/bin/bash

# Script to deploy Firestore indexes defined in firestore.indexes.json

# Determine the project ID from gcloud or use a default
PROJECT_ID=$(gcloud config get-value project)

echo "Deploying Firestore indexes to project: $PROJECT_ID"

# Check if firebase-tools is installed
if ! command -v firebase &> /dev/null; then
    echo "Firebase CLI tools not found. Installing..."
    npm install -g firebase-tools
fi

# Deploy the indexes
firebase use $PROJECT_ID
firebase firestore:indexes --project=$PROJECT_ID

echo "Firestore indexes deployment initiated."
echo "Note: Index creation may take several minutes to complete in the background."
echo "You can check the status in the Firebase console: https://console.firebase.google.com/project/$PROJECT_ID/firestore/indexes" 