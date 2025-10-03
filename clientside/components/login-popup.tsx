"use client"

import type React from "react"
import { useState } from "react"
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithPopup, GoogleAuthProvider, sendPasswordResetEmail } from "firebase/auth"
import { auth } from "@/lib/firebase"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { toast } from "sonner"

export function LoginForm({ className, onSuccess, ...props }: React.ComponentProps<"div"> & { onSuccess?: () => void }) {
  const [activeTab, setActiveTab] = useState("signin")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [fullName, setFullName] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const googleProvider = new GoogleAuthProvider()

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")
    
    try {
      await signInWithEmailAndPassword(auth, email, password)
      // Handle successful login - close dialog
      onSuccess?.()
    } catch (error: any) {
      setError(getErrorMessage(error))
    } finally {
      setLoading(false)
    }
  }

  const handleEmailSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")
    
    if (password !== confirmPassword) {
      setError("Passwords don't match")
      setLoading(false)
      return
    }

    try {
      await createUserWithEmailAndPassword(auth, email, password)
      // Handle successful signup - switch to signin tab
      setActiveTab("signin")
      setError("")
      // Clear form fields
      setEmail("")
      setPassword("")
      setConfirmPassword("")
      setFullName("")
      toast.success("Account created successfully! You can now sign in.")
    } catch (error: any) {
      setError(getErrorMessage(error))
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleSignIn = async () => {
    setLoading(true)
    setError("")
    
    try {
      await signInWithPopup(auth, googleProvider)
      // Handle successful login - close dialog
      onSuccess?.()
    } catch (error: any) {
      setError(getErrorMessage(error))
    } finally {
      setLoading(false)
    }
  }

  const getErrorMessage = (error: any) => {
    const errorCode = error.code
    switch (errorCode) {
      case 'auth/user-not-found':
        return 'No account found with this email address'
      case 'auth/wrong-password':
        return 'Incorrect password. Please try again'
      case 'auth/invalid-email':
        return 'Please enter a valid email address'
      case 'auth/user-disabled':
        return 'This account has been disabled'
      case 'auth/too-many-requests':
        return 'Too many failed attempts. Please try again later'
      case 'auth/email-already-in-use':
        return 'An account with this email already exists'
      case 'auth/weak-password':
        return 'Password should be at least 6 characters long'
      case 'auth/invalid-credential':
        return 'Invalid email or password. Please check your credentials'
      case 'auth/network-request-failed':
        return 'Network error. Please check your connection'
      case 'auth/popup-closed-by-user':
        return 'Sign-in was cancelled'
      default:
        return 'Something went wrong. Please try again'
    }
  }

  const handleForgotPassword = async () => {
    if (!email) {
      setError("Please enter your email address first")
      return
    }
    
    setLoading(true)
    setError("")
    
    try {
      await sendPasswordResetEmail(auth, email)
      toast.success("Password reset email sent! Check your inbox.")
    } catch (error: any) {
      setError(getErrorMessage(error))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <div className="grid p-0 md:grid-cols-2">
        <div className="p-6 md:p-8">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="signin">Sign In</TabsTrigger>
              <TabsTrigger value="signup">Sign Up</TabsTrigger>
            </TabsList>

            <TabsContent value="signin">
              <div className="w-full space-y-6">
                <DialogHeader>
                  <DialogTitle className="text-3xl font-bold text-center">
                    Welcome Back
                  </DialogTitle>
                  <p className="text-xl text-center text-muted-foreground">
                    Sign in to your account to continue
                  </p>
                </DialogHeader>

                <div className="bg-muted p-8 rounded-lg">
                  {error && (
                    <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
                      {error}
                    </div>
                  )}
                  <form onSubmit={handleEmailSignIn} className="space-y-6">
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="email" className="text-base">Email</Label>
                        <Input 
                          id="email" 
                          type="email" 
                          placeholder="Enter your email" 
                          required 
                          className="h-12"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="password" className="text-base">Password</Label>
                        <Input 
                          id="password" 
                          type="password" 
                          placeholder="Enter your password" 
                          required 
                          className="h-12"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="text-right">
                      <button 
                        type="button"
                        onClick={handleForgotPassword}
                        className="text-primary hover:underline text-base"
                        disabled={loading}
                      >
                        Forgot your password?
                      </button>
                    </div>

                    <Button type="submit" size="lg" className="w-full text-lg h-12" disabled={loading}>
                      {loading ? "Signing in..." : "Sign In"}
                    </Button>
                  </form>
                </div>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-sm uppercase">
                    <span className="bg-background px-4 text-muted-foreground">
                      Or continue with
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-6">
                  <Button 
                    variant="outline" 
                    size="lg" 
                    className="h-12 flex items-center gap-3"
                    onClick={handleGoogleSignIn}
                    disabled={loading}
                    type="button"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="h-5 w-5">
                      <path
                        d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z"
                        fill="currentColor"
                      />
                    </svg>
                    Continue with Google
                  </Button>
                </div>

                <div className="text-center text-lg">
                  Don't have an account?{" "}
                  <button
                    type="button"
                    onClick={() => setActiveTab("signup")}
                    className="text-primary hover:underline font-medium"
                  >
                    Sign up
                  </button>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="signup">
              <div className="w-full space-y-6">
                <DialogHeader>
                  <DialogTitle className="text-3xl font-bold text-center">
                    Create Account
                  </DialogTitle>
                  <p className="text-xl text-center text-muted-foreground">
                    Sign up for a new account
                  </p>
                </DialogHeader>

                <div className="bg-muted p-8 rounded-lg">
                  {error && (
                    <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
                      {error}
                    </div>
                  )}
                  <form onSubmit={handleEmailSignUp} className="space-y-6">
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="signup-name" className="text-base">Full Name</Label>
                        <Input 
                          id="signup-name" 
                          type="text" 
                          placeholder="John Doe" 
                          required 
                          className="h-12"
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="signup-email" className="text-base">Email</Label>
                        <Input 
                          id="signup-email" 
                          type="email" 
                          placeholder="m@example.com" 
                          required 
                          className="h-12"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="signup-password" className="text-base">Password</Label>
                        <Input 
                          id="signup-password" 
                          type="password" 
                          required 
                          className="h-12"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="signup-confirm-password" className="text-base">Confirm Password</Label>
                        <Input 
                          id="signup-confirm-password" 
                          type="password" 
                          required 
                          className="h-12"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                        />
                      </div>
                    </div>

                    <Button type="submit" size="lg" className="w-full text-lg h-12" disabled={loading}>
                      {loading ? "Creating account..." : "Sign Up"}
                    </Button>
                  </form>
                </div>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-sm uppercase">
                    <span className="bg-background px-4 text-muted-foreground">
                      Or continue with
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-6">
                  <Button 
                    variant="outline" 
                    size="lg" 
                    className="h-12 flex items-center gap-3"
                    onClick={handleGoogleSignIn}
                    disabled={loading}
                    type="button"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="h-5 w-5">
                      <path
                        d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z"
                        fill="currentColor"
                      />
                    </svg>
                    Continue with Google
                  </Button>
                </div>

                <div className="text-center text-lg">
                  Already have an account?{" "}
                  <button
                    type="button"
                    onClick={() => setActiveTab("signin")}
                    className="text-primary hover:underline font-medium"
                  >
                    Sign in
                  </button>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>

        <div className="bg-muted relative hidden md:block">
          <img
            src="/placeholder.svg"
            alt="Image"
            className="absolute inset-0 h-full w-full object-cover dark:brightness-[0.2] dark:grayscale"
          />
        </div>
      </div>
    </div>
  )
}