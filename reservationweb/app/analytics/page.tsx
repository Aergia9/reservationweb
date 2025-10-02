'use client'
import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Edit, Trash2 } from "lucide-react"
import React, { useState, useEffect } from 'react';
import { EventsDataTable } from "@/components/events-data-table";
import { db, auth, storage } from "@/lib/firebase";
import { 
  collection, 
  addDoc, 
  getDocs, 
  doc, 
  updateDoc, 
  deleteDoc,
  onSnapshot,
  Timestamp 
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { onAuthStateChanged, User } from "firebase/auth";

interface Item {
  id: string;
  title: string;
  description: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

interface EventItem {
  id?: string;
  name?: string;
  title?: string;
  description: string;
  price?: number;
  image?: string;
  images?: string[]; // Support for multiple images
  includes?: string[];
  duration?: string;
  eventType?: string;
  minGuests?: number;
  startDate?: string;
  endDate?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export default function Page() {
  const [items, setItems] = useState<EventItem[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  
  // Delete confirmation dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  
  // Edit dialog
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  
  // Form states for both regular items and special events - updated for multiple images
  const [selectedImageFiles, setSelectedImageFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    price: "",
    image: "/placeholder.svg",
    images: [] as string[],
    includes: "",
    duration: "",
    eventType: "",
    minGuests: "",
    startDate: "",
    endDate: ""
  });

  // Authentication state listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
      console.log('Auth state changed:', {
        user: currentUser,
        uid: currentUser?.uid,
        email: currentUser?.email,
        isAuthenticated: !!currentUser
      });
    });

    return () => unsubscribe();
  }, []);

  // Real-time listener for items - only start after auth is loaded
  useEffect(() => {
    if (authLoading) return; // Wait for auth to load
    
    console.log('Setting up Firestore listener with user:', user);
    
    const unsubscribe = onSnapshot(
      collection(db, 'event'), 
      (snapshot) => {
        const itemsData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as EventItem[];
        setItems(itemsData.sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis()));
        console.log('Firestore data loaded:', itemsData);
      },
      (error) => {
        console.error('Firestore listener error:', error);
        console.log('Current user when error occurred:', user);
        console.log('Auth loading state:', authLoading);
        alert('Error connecting to Firestore: ' + error.message);
      }
    );

    return () => unsubscribe();
  }, [user, authLoading]);

  // Create new item/event
  const handleCreate = async () => {
    if (!formData.name.trim() && !formData.description.trim()) {
      alert('Please fill in at least the name or description');
      return;
    }
    if (!user) {
      alert('You must be authenticated to create items');
      return;
    }
    
    setLoading(true);
    
    try {
      let imageUrl = formData.image || "/placeholder.svg";
      
      // Handle multiple image uploads if files are selected
      let imageUrls: string[] = [];
      if (selectedImageFiles.length > 0) {
        try {
          const uploadPromises = selectedImageFiles.map(async (file, index) => {
            const timestamp = Date.now();
            const filename = `event-images/${timestamp}-${index}-${file.name}`;
            const storageRef = ref(storage, filename);
            
            const uploadResult = await uploadBytes(storageRef, file);
            return await getDownloadURL(uploadResult.ref);
          });
          
          imageUrls = await Promise.all(uploadPromises);
          console.log('Multiple images uploaded successfully:', imageUrls);
        } catch (uploadError) {
          console.error('Error uploading images:', uploadError);
          alert('Failed to upload some images, continuing with uploaded ones.');
        }
      }
      
      // Set primary image (first uploaded image or manual URL)
      if (imageUrls.length > 0) {
        imageUrl = imageUrls[0];
      } else if (formData.image && formData.image !== "/placeholder.svg") {
        imageUrl = formData.image;
        imageUrls = [formData.image];
      }
      
      // Create item data - handle both regular items and special events
      const itemData: any = {
        description: formData.description,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        createdBy: user.uid
      };
      
      // Add event-specific fields if they exist
      if (formData.name.trim()) {
        itemData.name = formData.name;
        itemData.title = formData.name; // For compatibility
      }
      if (formData.price) itemData.price = parseFloat(formData.price) || 0;
      if (imageUrl !== "/placeholder.svg") itemData.image = imageUrl;
      if (imageUrls.length > 0) itemData.images = imageUrls; // Store multiple images
      if (formData.includes) itemData.includes = formData.includes.split(',').map((item: string) => item.trim()).filter((item: string) => item);
      if (formData.duration) itemData.duration = formData.duration;
      if (formData.eventType) itemData.eventType = formData.eventType;
      if (formData.minGuests) itemData.minGuests = parseInt(formData.minGuests) || 1;
      if (formData.startDate) itemData.startDate = formData.startDate;
      if (formData.endDate) itemData.endDate = formData.endDate;
      
      const docRef = await addDoc(collection(db, 'event'), itemData);
      
      console.log('✅ Item created successfully with ID:', docRef.id);
      
      // Reset form
      setFormData({
        name: "",
        description: "",
        price: "",
        image: "/placeholder.svg",
        images: [],
        includes: "",
        duration: "",
        eventType: "",
        minGuests: "",
        startDate: "",
        endDate: ""
      });
      setSelectedImageFiles([]);
      setImagePreviews([]);
      
      // Clean up all preview URLs
      imagePreviews.forEach(url => URL.revokeObjectURL(url));
      
    } catch (error) {
      console.error('❌ Error creating item:', error);
      if (error instanceof Error) {
        alert('Error creating item: ' + error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  // Update existing item
  const handleUpdate = async () => {
    if (!editingId || (!formData.name.trim() && !formData.description.trim())) return;
    if (!user) {
      alert('You must be authenticated to update items');
      return;
    }
    
    setLoading(true);
    try {
      let imageUrl = formData.image || "/placeholder.svg";
      
      // Handle multiple image uploads if files are selected
      const existingImages = items.find(item => item.id === editingId)?.images || [];
      let imageUrls: string[] = existingImages;
      if (selectedImageFiles.length > 0) {
        try {
          const uploadPromises = selectedImageFiles.map(async (file, index) => {
            const timestamp = Date.now();
            const filename = `event-images/${timestamp}-${index}-${file.name}`;
            const storageRef = ref(storage, filename);
            
            const uploadResult = await uploadBytes(storageRef, file);
            return await getDownloadURL(uploadResult.ref);
          });
          
          const newImageUrls = await Promise.all(uploadPromises);
          imageUrls = [...imageUrls, ...newImageUrls]; // Add new images to existing ones
          console.log('Multiple images uploaded successfully:', newImageUrls);
        } catch (uploadError) {
          console.error('Error uploading images:', uploadError);
          alert('Failed to upload some images, keeping existing images.');
        }
      }
      
      // Set primary image (first image in array or manual URL)
      if (imageUrls.length > 0) {
        imageUrl = imageUrls[0];
      } else if (formData.image && formData.image !== "/placeholder.svg") {
        imageUrl = formData.image;
        if (!imageUrls.includes(formData.image)) {
          imageUrls = [formData.image, ...imageUrls];
        }
      }
      
      // Update item data
      const updateData: any = {
        description: formData.description,
        updatedAt: Timestamp.now(),
        updatedBy: user.uid
      };
      
      // Add event-specific fields if they exist
      if (formData.name.trim()) {
        updateData.name = formData.name;
        updateData.title = formData.name; // For compatibility
      }
      if (formData.price) updateData.price = parseFloat(formData.price) || 0;
      if (imageUrl !== "/placeholder.svg") updateData.image = imageUrl;
      if (imageUrls.length > 0) updateData.images = imageUrls; // Store multiple images
      if (formData.includes) updateData.includes = formData.includes.split(',').map(item => item.trim()).filter(item => item);
      if (formData.duration) updateData.duration = formData.duration;
      if (formData.eventType) updateData.eventType = formData.eventType;
      if (formData.minGuests) updateData.minGuests = parseInt(formData.minGuests) || 1;
      if (formData.startDate) updateData.startDate = formData.startDate;
      if (formData.endDate) updateData.endDate = formData.endDate;
      
      await updateDoc(doc(db, 'event', editingId), updateData);
      
      // Reset form and close edit mode
      setEditingId(null);
      setIsEditDialogOpen(false);
      setFormData({
        name: "",
        description: "",
        price: "",
        image: "/placeholder.svg",
        images: [],
        includes: "",
        duration: "",
        eventType: "",
        minGuests: "",
        startDate: "",
        endDate: ""
      });
      setSelectedImageFiles([]);
      setImagePreviews([]);
      
      // Clean up all preview URLs
      imagePreviews.forEach(url => URL.revokeObjectURL(url));
      
    } catch (error) {
      console.error('Error updating item:', error);
      alert('Error updating item: ' + (error as Error).message);
    }
    setLoading(false);
  };

  // Delete item with confirmation dialog
  const confirmDelete = (id: string) => {
    setItemToDelete(id);
    setDeleteDialogOpen(true);
  };
  
  const handleDelete = async () => {
    if (!itemToDelete || !user) return;
    
    try {
      await deleteDoc(doc(db, 'event', itemToDelete));
      setDeleteDialogOpen(false);
      setItemToDelete(null);
    } catch (error) {
      console.error('Error deleting item:', error);
      alert('Error deleting item: ' + (error as Error).message);
    }
  };

  // Start editing
  const startEdit = (item: EventItem) => {
    setEditingId(item.id!);
    setFormData({
      name: item.name || item.title || "",
      description: item.description,
      price: item.price?.toString() || "",
      image: item.image || "/placeholder.svg",
      images: item.images || [],
      includes: item.includes?.join(', ') || "",
      duration: item.duration || "",
      eventType: item.eventType || "",
      minGuests: item.minGuests?.toString() || "",
      startDate: item.startDate || "",
      endDate: item.endDate || ""
    });
    // Show existing images as previews
    setImagePreviews(item.images || [item.image].filter((img): img is string => Boolean(img)));
    setIsEditDialogOpen(true);
  };

  // Cancel editing
  const cancelEdit = () => {
    setEditingId(null);
    setIsEditDialogOpen(false);
    setFormData({
      name: "",
      description: "",
      price: "",
      image: "/placeholder.svg",
      images: [],
      includes: "",
      duration: "",
      eventType: "",
      minGuests: "",
      startDate: "",
      endDate: ""
    });
    setSelectedImageFiles([]);
    setImagePreviews([]);
    
    // Clean up all preview URLs
    imagePreviews.forEach(url => URL.revokeObjectURL(url));
  };

  // Handle multiple image file selection
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      setSelectedImageFiles(files);
      
      // Create preview URLs for all selected files
      const previewUrls = files.map(file => URL.createObjectURL(file));
      setImagePreviews(previewUrls);
      
      // Clear the manual URL field when files are selected
      setFormData({ ...formData, image: "", images: [] });
    }
  };
  
  // Remove a specific image from selection
  const removeImagePreview = (index: number) => {
    const newFiles = selectedImageFiles.filter((_, i) => i !== index);
    const newPreviews = imagePreviews.filter((_, i) => i !== index);
    
    // Revoke the removed URL to free memory
    URL.revokeObjectURL(imagePreviews[index]);
    
    setSelectedImageFiles(newFiles);
    setImagePreviews(newPreviews);
  };

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 72)",
          "--header-height": "calc(var(--spacing) * 12)",
        } as React.CSSProperties
      }
    >
      <AppSidebar variant="inset" />
      <SidebarInset>
        <SiteHeader />
        <div className="flex flex-1 flex-col">
          <div className="@container/main flex flex-1 flex-col gap-2">
            <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
              <div className="px-4 lg:px-6">
                <div className="max-w-4xl mx-auto space-y-6">
                  <div className="flex justify-between items-center">
                    <h1 className="text-3xl font-bold">Analytics CRUD</h1>

                    
                    {/* Authentication Status */}
                    <div className="text-right">
                      {authLoading ? (
                        <Badge variant="outline">Loading auth...</Badge>
                      ) : user ? (
                        <div className="space-y-1">
                          <Badge variant="default">Authenticated</Badge>
                          <div className="text-sm text-muted-foreground">
                            <div>UID: <span className="font-mono bg-muted px-1 rounded">{user.uid}</span></div>
                            <div>Email: {user.email || 'No email'}</div>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-1">
                          <Badge variant="destructive">Not Authenticated</Badge>
                          <div className="text-sm text-muted-foreground">
                            UID: <span className="font-mono bg-muted px-1 rounded">null</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Create/Update Event Form */}
                  <Card>
                    <CardHeader>
                      <CardTitle>
                        {editingId ? 'Update Event' : 'Create New Event'}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="name">Event Name *</Label>
                          <Input
                            id="name"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            placeholder="Special event name"
                          />
                        </div>
                        <div>
                          <Label htmlFor="eventType">Event Type</Label>
                          <Select value={formData.eventType} onValueChange={(value) => setFormData({ ...formData, eventType: value })}>
                            <SelectTrigger>
                              <SelectValue placeholder="Select event type" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Culinary Experience">Culinary Experience</SelectItem>
                              <SelectItem value="Entertainment">Entertainment</SelectItem>
                              <SelectItem value="Corporate Event">Corporate Event</SelectItem>
                              <SelectItem value="Wedding">Wedding</SelectItem>
                              <SelectItem value="Conference">Conference</SelectItem>
                              <SelectItem value="Special Occasion">Special Occasion</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      
                      <div>
                        <Label htmlFor="description">Description</Label>
                        <Textarea
                          id="description"
                          value={formData.description}
                          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                          placeholder="Event description"
                          rows={3}
                        />
                      </div>

                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <Label htmlFor="price">Price per Person (Rp)</Label>
                          <Input
                            id="price"
                            type="number"
                            value={formData.price}
                            onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                            placeholder="150"
                            min="0"
                            step="0.01"
                          />
                        </div>
                        <div>
                          <Label htmlFor="minGuests">Minimum Guests</Label>
                          <Input
                            id="minGuests"
                            type="number"
                            value={formData.minGuests}
                            onChange={(e) => setFormData({ ...formData, minGuests: e.target.value })}
                            placeholder="1"
                            min="1"
                          />
                        </div>
                        <div>
                          <Label htmlFor="duration">Duration</Label>
                          <Input
                            id="duration"
                            value={formData.duration}
                            onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                            placeholder="3 hours"
                          />
                        </div>
                      </div>

                      <div>
                        <Label htmlFor="includes">What's Included (comma-separated)</Label>
                        <Textarea
                          id="includes"
                          value={formData.includes}
                          onChange={(e) => setFormData({ ...formData, includes: e.target.value })}
                          placeholder="5-Course Dinner, Wine Pairings, Sommelier Service"
                          rows={2}
                        />
                      </div>

                        <div>
                          <Label htmlFor="imageFile">Event Images</Label>
                          <Input
                            id="imageFile"
                            type="file"
                            accept="image/*"
                            multiple
                            onChange={handleImageChange}
                            className="mb-2"
                          />
                          <p className="text-sm text-gray-500 mb-2">Select multiple images for this event</p>
                          
                          {/* Image Previews */}
                          {imagePreviews.length > 0 && (
                            <div className="grid grid-cols-3 gap-2 mt-2">
                              {imagePreviews.map((preview, index) => (
                                <div key={index} className="relative">
                                  <img
                                    src={preview}
                                    alt={`Preview ${index + 1}`}
                                    className="w-full h-24 object-cover rounded-md border"
                                  />
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="absolute -top-2 -right-2 h-6 w-6 rounded-full p-0"
                                    onClick={() => removeImagePreview(index)}
                                  >
                                    ×
                                  </Button>
                                </div>
                              ))}
                            </div>
                          )}
                          
                          <div className="mt-2">
                            <Label htmlFor="imageUrl">Or enter Image URL</Label>
                            <Input
                              id="imageUrl"
                              value={formData.image}
                              onChange={(e) => setFormData({ ...formData, image: e.target.value })}
                              placeholder="/placeholder.svg"
                            />
                          </div>
                        </div>                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="startDate">Start Date</Label>
                          <Input
                            id="startDate"
                            type="date"
                            value={formData.startDate}
                            onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                          />
                        </div>
                        <div>
                          <Label htmlFor="endDate">End Date</Label>
                          <Input
                            id="endDate"
                            type="date"
                            value={formData.endDate}
                            onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                          />
                        </div>
                      </div>

                      <div className="flex gap-2">
                        {editingId ? (
                          <>
                            <Button 
                              onClick={handleUpdate}
                              disabled={loading}
                            >
                              {loading ? 'Updating...' : 'Update Event'}
                            </Button>
                            <Button variant="outline" onClick={cancelEdit}>
                              Cancel
                            </Button>
                          </>
                        ) : (
                          <Button 
                            onClick={handleCreate}
                            disabled={loading || !user}
                          >
                            {loading ? 'Creating...' : 'Create Event'}
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Events Table */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Events ({items.length})</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <EventsDataTable 
                        data={items}
                        onEdit={startEdit}
                        onDelete={confirmDelete}
                      />
                    </CardContent>
                  </Card>
                  
                  {/* Delete Confirmation Dialog */}
                  <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This action cannot be undone. This will permanently delete the event from the database.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setDeleteDialogOpen(false)}>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                  
                  {/* Edit Dialog */}
                  <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                    <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle>Edit Event</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label htmlFor="edit-name">Event Name *</Label>
                            <Input
                              id="edit-name"
                              value={formData.name}
                              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                              placeholder="Special event name"
                            />
                          </div>
                          <div>
                            <Label htmlFor="edit-eventType">Event Type</Label>
                            <Select value={formData.eventType} onValueChange={(value) => setFormData({ ...formData, eventType: value })}>
                              <SelectTrigger>
                                <SelectValue placeholder="Select event type" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Culinary Experience">Culinary Experience</SelectItem>
                                <SelectItem value="Entertainment">Entertainment</SelectItem>
                                <SelectItem value="Corporate Event">Corporate Event</SelectItem>
                                <SelectItem value="Wedding">Wedding</SelectItem>
                                <SelectItem value="Conference">Conference</SelectItem>
                                <SelectItem value="Special Occasion">Special Occasion</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        
                        <div>
                          <Label htmlFor="edit-description">Description</Label>
                          <Textarea
                            id="edit-description"
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            placeholder="Event description"
                            rows={3}
                          />
                        </div>

                        <div className="grid grid-cols-3 gap-4">
                          <div>
                            <Label htmlFor="edit-price">Price per Person</Label>
                            <Input
                              id="edit-price"
                              type="number"
                              value={formData.price}
                              onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                              placeholder="150"
                              min="0"
                              step="0.01"
                            />
                          </div>
                          <div>
                            <Label htmlFor="edit-minGuests">Minimum Guests</Label>
                            <Input
                              id="edit-minGuests"
                              type="number"
                              value={formData.minGuests}
                              onChange={(e) => setFormData({ ...formData, minGuests: e.target.value })}
                              placeholder="1"
                              min="1"
                            />
                          </div>
                          <div>
                            <Label htmlFor="edit-duration">Duration</Label>
                            <Input
                              id="edit-duration"
                              value={formData.duration}
                              onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                              placeholder="3 hours"
                            />
                          </div>
                        </div>

                        <div>
                          <Label htmlFor="edit-includes">What's Included (comma-separated)</Label>
                          <Textarea
                            id="edit-includes"
                            value={formData.includes}
                            onChange={(e) => setFormData({ ...formData, includes: e.target.value })}
                            placeholder="5-Course Dinner, Wine Pairings, Sommelier Service"
                            rows={2}
                          />
                        </div>

                          <div>
                            <Label htmlFor="edit-imageFile">Event Images</Label>
                            <Input
                              id="edit-imageFile"
                              type="file"
                              accept="image/*"
                              multiple
                              onChange={handleImageChange}
                              className="mb-2"
                            />
                            <p className="text-sm text-gray-500 mb-2">Select multiple images for this event</p>
                            
                            {/* Image Previews */}
                            {imagePreviews.length > 0 && (
                              <div className="grid grid-cols-3 gap-2 mt-2">
                                {imagePreviews.map((preview, index) => (
                                  <div key={index} className="relative">
                                    <img
                                      src={preview}
                                      alt={`Preview ${index + 1}`}
                                      className="w-full h-24 object-cover rounded-md border"
                                    />
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      className="absolute -top-2 -right-2 h-6 w-6 rounded-full p-0"
                                      onClick={() => removeImagePreview(index)}
                                    >
                                      ×
                                    </Button>
                                  </div>
                                ))}
                              </div>
                            )}
                            
                            <div className="mt-2">
                              <Label htmlFor="edit-imageUrl">Or enter Image URL</Label>
                              <Input
                                id="edit-imageUrl"
                                value={formData.image}
                                onChange={(e) => setFormData({ ...formData, image: e.target.value })}
                                placeholder="/placeholder.svg"
                              />
                            </div>
                          </div>                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label htmlFor="edit-startDate">Start Date</Label>
                            <Input
                              id="edit-startDate"
                              type="date"
                              value={formData.startDate}
                              onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                            />
                          </div>
                          <div>
                            <Label htmlFor="edit-endDate">End Date</Label>
                            <Input
                              id="edit-endDate"
                              type="date"
                              value={formData.endDate}
                              onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                            />
                          </div>
                        </div>

                        <div className="flex justify-end gap-2">
                          <Button variant="outline" onClick={cancelEdit}>
                            Cancel
                          </Button>
                          <Button onClick={handleUpdate} disabled={loading}>
                            {loading ? 'Updating...' : 'Update Event'}
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}