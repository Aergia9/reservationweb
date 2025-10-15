'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit, Trash2, Upload, Eye } from "lucide-react";
import { toast } from "sonner";
import { sliderService, SliderImage } from '../services/slider-service';

export function ImageSliderManager() {
  const [images, setImages] = useState<SliderImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingImage, setEditingImage] = useState<SliderImage | null>(null);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [formData, setFormData] = useState({
    url: '',
    title: '',
    description: '',
    isActive: true
  });

  // Subscribe to slider images from Firebase
  useEffect(() => {
    const unsubscribe = sliderService.subscribeToSliderImages((firebaseImages) => {
      setImages(firebaseImages);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        toast.error('Please select an image file');
        return;
      }
      
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast.error('File size must be less than 5MB');
        return;
      }
      
      setSelectedFile(file);
      // Clear URL field when file is selected
      setFormData(prev => ({ ...prev, url: '' }));
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { id, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [id]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    }));
    
    // Clear selected file when URL is entered
    if (id === 'url' && value) {
      setSelectedFile(null);
    }
  };

  const handleAddImage = async () => {
    if (!formData.title) {
      toast.error('Please fill in the title');
      return;
    }

    if (!selectedFile && !formData.url) {
      toast.error('Please select an image file or provide an image URL');
      return;
    }

    try {
      setUploading(true);
      let imageUrl = formData.url;
      
      // Upload file if selected
      if (selectedFile) {
        imageUrl = await sliderService.uploadSliderImage(selectedFile);
      }

      const newImageData = {
        url: imageUrl,
        title: formData.title,
        description: formData.description,
        isActive: formData.isActive,
        order: images.length + 1
      };

      await sliderService.addSliderImage(newImageData);
      setFormData({ url: '', title: '', description: '', isActive: true });
      setSelectedFile(null);
      setIsAddDialogOpen(false);
      toast.success('Image added to slider');
    } catch (error) {
      console.error('Error adding image:', error);
      toast.error('Failed to add image');
    } finally {
      setUploading(false);
    }
  };

  const handleEditImage = (image: SliderImage) => {
    setEditingImage(image);
    setFormData({
      url: image.url,
      title: image.title,
      description: image.description,
      isActive: image.isActive
    });
  };

  const handleUpdateImage = async () => {
    if (!editingImage || !formData.url || !formData.title) {
      toast.error('Please fill in URL and title');
      return;
    }

    try {
      await sliderService.updateSliderImage(editingImage.id, {
        url: formData.url,
        title: formData.title,
        description: formData.description,
        isActive: formData.isActive
      });
      
      setEditingImage(null);
      setFormData({ url: '', title: '', description: '', isActive: true });
      toast.success('Image updated');
    } catch (error) {
      console.error('Error updating image:', error);
      toast.error('Failed to update image');
    }
  };

  const handleDeleteImage = async (id: string, imageUrl: string) => {
    try {
      await sliderService.deleteSliderImage(id, imageUrl);
      toast.success('Image removed from slider');
    } catch (error) {
      console.error('Error deleting image:', error);
      toast.error('Failed to delete image');
    }
  };

  const toggleImageStatus = async (id: string, isActive: boolean) => {
    try {
      await sliderService.toggleActiveStatus(id, !isActive);
      toast.success(`Image ${!isActive ? 'activated' : 'deactivated'}`);
    } catch (error) {
      console.error('Error toggling status:', error);
      toast.error('Failed to update status');
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Homepage Image Slider</CardTitle>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Add Image
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-white text-black max-w-md">
              <DialogHeader>
                <DialogTitle className="text-black text-lg font-semibold">Add New Slider Image</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 text-black">
                <div>
                  <Label htmlFor="file-upload" className="text-black font-medium mb-2 block">Choose Image from Device</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="file-upload"
                      type="file"
                      accept="image/*"
                      onChange={handleFileSelect}
                      className="cursor-pointer border-2 border-gray-300 bg-white text-black"
                    />
                    {selectedFile && (
                      <Badge variant="outline" className="text-green-600 border-green-600 bg-green-50">
                        {selectedFile.name}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-gray-600 mt-1">Max file size: 5MB. Supported formats: JPG, PNG, GIF, WebP</p>
                </div>
                
                <div className="flex items-center gap-4">
                  <div className="flex-1 border-t border-gray-400"></div>
                  <span className="text-sm text-gray-700 font-medium">OR</span>
                  <div className="flex-1 border-t border-gray-400"></div>
                </div>
                
                <div>
                  <Label htmlFor="url" className="text-black font-medium mb-2 block">Image URL</Label>
                  <Input
                    id="url"
                    placeholder="https://example.com/image.jpg"
                    value={formData.url}
                    onChange={handleInputChange}
                    disabled={!!selectedFile}
                    className="border-2 border-gray-300 bg-white text-black disabled:bg-gray-100 disabled:text-gray-500"
                  />
                  <p className="text-xs text-gray-600 mt-1">Enter an image URL if not uploading from device</p>
                </div>
                <div>
                  <Label htmlFor="title" className="text-black font-medium mb-2 block">Title *</Label>
                  <Input
                    id="title"
                    placeholder="Image title"
                    value={formData.title}
                    onChange={handleInputChange}
                    required
                    className="border-2 border-gray-300 bg-white text-black"
                  />
                </div>
                <div>
                  <Label htmlFor="description" className="text-black font-medium mb-2 block">Description</Label>
                  <Input
                    id="description"
                    placeholder="Image description"
                    value={formData.description}
                    onChange={handleInputChange}
                    className="border-2 border-gray-300 bg-white text-black"
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="isActive"
                    checked={formData.isActive}
                    onChange={handleInputChange}
                    className="rounded border-2 border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <Label htmlFor="isActive" className="text-black font-medium">Active</Label>
                </div>
                <div className="flex gap-2 pt-2">
                  <Button 
                    onClick={handleAddImage} 
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white border-2 border-blue-600 font-medium" 
                    disabled={uploading}
                  >
                    {uploading ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Uploading...
                      </>
                    ) : (
                      'Add Image'
                    )}
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      setIsAddDialogOpen(false);
                      setSelectedFile(null);
                      setFormData({ url: '', title: '', description: '', isActive: true });
                    }} 
                    className="flex-1 bg-white hover:bg-gray-50 text-black border-2 border-gray-300 font-medium"
                    disabled={uploading}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
              <p className="text-muted-foreground">Loading slider images...</p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {images.map((image) => (
            <div key={image.id} className="border rounded-lg p-4 flex items-center gap-4">
              <div className="w-24 h-16 rounded overflow-hidden">
                <img 
                  src={image.url} 
                  alt={image.title}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-black">{image.title}</h3>
                  <Badge variant={image.isActive ? "default" : "secondary"}>
                    {image.isActive ? "Active" : "Inactive"}
                  </Badge>
                </div>
                <p className="text-sm text-gray-600">{image.description}</p>
                <p className="text-xs text-gray-400 truncate">{image.url}</p>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => toggleImageStatus(image.id, image.isActive)}
                >
                  <Eye className="h-4 w-4" />
                </Button>
                <Dialog>
                  <DialogTrigger asChild>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => handleEditImage(image)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="bg-white">
                    <DialogHeader>
                      <DialogTitle className="text-black">Edit Slider Image</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="url" className="text-black">Image URL</Label>
                        <Input
                          id="url"
                          placeholder="https://example.com/image.jpg"
                          value={formData.url}
                          onChange={handleInputChange}
                        />
                      </div>
                      <div>
                        <Label htmlFor="title" className="text-black">Title</Label>
                        <Input
                          id="title"
                          placeholder="Image title"
                          value={formData.title}
                          onChange={handleInputChange}
                        />
                      </div>
                      <div>
                        <Label htmlFor="description" className="text-black">Description</Label>
                        <Input
                          id="description"
                          placeholder="Image description"
                          value={formData.description}
                          onChange={handleInputChange}
                        />
                      </div>
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id="isActive"
                          checked={formData.isActive}
                          onChange={handleInputChange}
                          className="rounded"
                        />
                        <Label htmlFor="isActive" className="text-black">Active</Label>
                      </div>
                      <div className="flex gap-2">
                        <Button onClick={handleUpdateImage} className="flex-1">
                          Update Image
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => handleDeleteImage(image.id, image.url)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
            
            {images.length === 0 && !loading && (
              <div className="text-center py-8 text-gray-500">
                No images in slider. Add some images to get started.
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}