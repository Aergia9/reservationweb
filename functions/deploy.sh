#!/bin/bash
# Deployment script for WhatsApp webhook

echo "🚀 Deploying WhatsApp Webhook to Firebase Functions..."

# Build the project
echo "📦 Building project..."
npm run build

# Deploy to Firebase
echo "🌐 Deploying to Firebase..."
firebase deploy --only functions

echo "✅ Deployment complete!"
echo ""
echo "📋 Next steps:"
echo "1. Copy your function URL from the output above"
echo "2. Configure your WhatsApp webhook in Meta Business Manager"
echo "3. Set your environment variables:"
echo "   firebase functions:config:set whatsapp.access_token=\"your_token\""
echo "   firebase functions:config:set whatsapp.phone_number_id=\"your_phone_id\""
echo "   firebase functions:config:set whatsapp.verify_token=\"your_verify_token\""
echo "4. Test your webhook with a WhatsApp message"