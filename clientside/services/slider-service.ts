import { 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  getDocs, 
  onSnapshot, 
  query, 
  orderBy, 
  where,
  Timestamp 
} from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage'
import { db, storage } from '@/lib/firebase'

export interface SliderImage {
  id: string
  url: string
  title: string
  description: string
  isActive: boolean
  order: number
  createdAt: Timestamp
  updatedAt: Timestamp
}

export const sliderService = {
  // Upload image file to Firebase Storage
  async uploadSliderImage(file: File): Promise<string> {
    try {
      const timestamp = Date.now()
      const fileName = `slider-images/${timestamp}-${file.name}`
      const storageRef = ref(storage, fileName)
      
      const snapshot = await uploadBytes(storageRef, file)
      const downloadURL = await getDownloadURL(snapshot.ref)
      
      return downloadURL
    } catch (error) {
      console.error('Error uploading image:', error)
      throw error
    }
  },

  // Delete image from Firebase Storage
  async deleteImageFromStorage(imageUrl: string): Promise<void> {
    try {
      // Extract the file path from the download URL
      const urlParts = imageUrl.split('/')
      const pathWithQuery = urlParts[urlParts.length - 1]
      const pathParts = pathWithQuery.split('?')
      const fileName = decodeURIComponent(pathParts[0])
      
      if (fileName.includes('slider-images/')) {
        const storageRef = ref(storage, fileName)
        await deleteObject(storageRef)
      }
    } catch (error) {
      console.error('Error deleting image from storage:', error)
      // Don't throw error here as the document deletion should still proceed
    }
  },
  // Get all slider images (active only for display)
  async getSliderImages(activeOnly: boolean = false): Promise<SliderImage[]> {
    try {
      let q
      
      if (activeOnly) {
        // Use simple query with single field to avoid compound index
        q = query(collection(db, 'sliderImages'), where('isActive', '==', true))
      } else {
        // Get all images without ordering to avoid index requirement
        q = collection(db, 'sliderImages')
      }
      
      const querySnapshot = await getDocs(q)
      const images = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as SliderImage))
      
      // Sort manually by order field
      return images.sort((a, b) => (a.order || 0) - (b.order || 0))
    } catch (error) {
      console.error('Error getting slider images:', error)
      return []
    }
  },

  // Subscribe to slider images for real-time updates
  subscribeToSliderImages(callback: (images: SliderImage[]) => void, activeOnly: boolean = false) {
    try {
      let q
      
      if (activeOnly) {
        // Use simple query with single field to avoid compound index
        q = query(collection(db, 'sliderImages'), where('isActive', '==', true))
      } else {
        // Get all images without ordering to avoid index requirement
        q = collection(db, 'sliderImages')
      }
      
      return onSnapshot(q, (querySnapshot) => {
        const images = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as SliderImage))
        
        // Sort manually by order field
        const sortedImages = images.sort((a, b) => (a.order || 0) - (b.order || 0))
        callback(sortedImages)
      })
    } catch (error) {
      console.error('Error subscribing to slider images:', error)
      return () => {} // Return empty unsubscribe function
    }
  },

  // Add new slider image
  async addSliderImage(imageData: Omit<SliderImage, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    try {
      const docRef = await addDoc(collection(db, 'sliderImages'), {
        ...imageData,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      })
      return docRef.id
    } catch (error) {
      console.error('Error adding slider image:', error)
      throw error
    }
  },

  // Update slider image
  async updateSliderImage(id: string, updates: Partial<Omit<SliderImage, 'id' | 'createdAt'>>): Promise<void> {
    try {
      await updateDoc(doc(db, 'sliderImages', id), {
        ...updates,
        updatedAt: Timestamp.now()
      })
    } catch (error) {
      console.error('Error updating slider image:', error)
      throw error
    }
  },

  // Delete slider image
  async deleteSliderImage(id: string, imageUrl?: string): Promise<void> {
    try {
      // Delete from Firestore
      await deleteDoc(doc(db, 'sliderImages', id))
      
      // Delete from Storage if URL is provided and it's a Firebase Storage URL
      if (imageUrl && imageUrl.includes('firebasestorage.googleapis.com')) {
        await this.deleteImageFromStorage(imageUrl)
      }
    } catch (error) {
      console.error('Error deleting slider image:', error)
      throw error
    }
  },

  // Toggle active status
  async toggleActiveStatus(id: string, isActive: boolean): Promise<void> {
    try {
      await this.updateSliderImage(id, { isActive })
    } catch (error) {
      console.error('Error toggling active status:', error)
      throw error
    }
  },

  // Reorder images
  async reorderImages(imageUpdates: { id: string; order: number }[]): Promise<void> {
    try {
      const promises = imageUpdates.map(update => 
        this.updateSliderImage(update.id, { order: update.order })
      )
      await Promise.all(promises)
    } catch (error) {
      console.error('Error reordering images:', error)
      throw error
    }
  }
}