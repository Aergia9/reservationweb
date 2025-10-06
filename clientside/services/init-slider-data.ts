// This file can be run to add initial slider images to Firebase
// You can use this in your browser console or create a temporary script

import { sliderService } from './slider-service'

export async function addInitialSliderImages() {
  const initialImages = [
    {
      url: 'https://images.unsplash.com/photo-1551218808-94e220e084d2?w=1920&h=1080&fit=crop',
      title: 'Luxury Hotel Interior',
      description: 'Beautiful hotel lobby and dining area',
      isActive: true,
      order: 1
    },
    {
      url: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=1920&h=1080&fit=crop',
      title: 'Elegant Dining',
      description: 'Fine dining experience with city views',
      isActive: true,
      order: 2
    },
    {
      url: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=1920&h=1080&fit=crop',
      title: 'Restaurant Ambiance',
      description: 'Perfect atmosphere for special occasions',
      isActive: true,
      order: 3
    }
  ]

  try {
    for (const image of initialImages) {
      await sliderService.addSliderImage(image)
      console.log(`Added: ${image.title}`)
    }
    console.log('All initial images added successfully!')
  } catch (error) {
    console.error('Error adding initial images:', error)
  }
}

// Uncomment the line below to run this function
// addInitialSliderImages()