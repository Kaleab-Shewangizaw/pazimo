// "use client"

// import { useState } from "react"
// import {
//   ChevronLeft,
//   ChevronRight,
//   CreditCard,
//   Sparkles,
//   Shield,
//   Zap,
//   Users,
//   TrendingUp,
//   CheckCircle,
//   Eye,
//   EyeOff,
// } from "lucide-react"
// import { Button } from "@/components/ui/button"
// import { Input } from "@/components/ui/input"
// import { Textarea } from "@/components/ui/textarea"
// import { Checkbox } from "@/components/ui/checkbox"
// import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
// import { Card, CardContent } from "@/components/ui/card"
// import Image from "next/image"
// import { toast } from "sonner"
// import { useRouter } from "next/navigation"

// const steps = ["Basic Information", "Event Registration", "Event Details", "Additional Information"]

// export default function OrganizerHome() {
//   const [openDialog, setOpenDialog] = useState(false)
//   const [activeStep, setActiveStep] = useState(0)
//   const [formData, setFormData] = useState({
//     organizerName: "",
//     contactPerson: "",
//     phoneNumber: "",
//     email: "",
//     password: "",
//     eventName: "",
//     eventType: "",
//     eventDescription: "",
//     eventDateTime: "",
//     eventLocation: "",
//     expectedAttendees: "",
//     ticketTypes: {
//       regular: false,
//       vip: false,
//       vvip: false,
//       earlyBird: false,
//       bundle: false,
//     },
//     ageRestriction: "",
//     promoCode: "",
//     offerPromo: false,
//     marketingSupport: false,
//     frontPageAd: false,
//     onsiteSupport: false,
//   })
//   const [isLoading, setIsLoading] = useState(false)
//   const router = useRouter()
//   const [showPassword, setShowPassword] = useState(false)

//   const handleNext = () => {
//     if (activeStep < steps.length - 1) {
//       setActiveStep(activeStep + 1)
//     }
//   }

//   const handleBack = () => {
//     if (activeStep > 0) {
//       setActiveStep(activeStep - 1)
//     }
//   }

//   const handleStepClick = (step: number) => {
//     setActiveStep(step)
//   }

//   const updateFormData = (field: string, value: any) => {
//     setFormData((prev) => ({
//       ...prev,
//       [field]: value,
//     }))
//   }

//   const handleSubmit = async (e: React.FormEvent) => {
//     e.preventDefault()
//     setIsLoading(true)

//     try {
//       const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/organizers/sign-up`, {
//         method: 'POST',
//         headers: {
//           'Content-Type': 'application/json'
//         },
//         body: JSON.stringify({
//           name: formData.contactPerson,
//           email: formData.email,
//           phone: formData.phoneNumber,
//           organization: formData.organizerName,
//           password: formData.password || Math.random().toString(36).slice(-8), // Generate a random password if not provided
//           eventDetails: {
//             eventName: formData.eventName,
//             eventType: formData.eventType,
//             eventDescription: formData.eventDescription,
//             eventDateTime: formData.eventDateTime,
//             eventLocation: formData.eventLocation,
//             expectedAttendees: formData.expectedAttendees,
//             ticketTypes: formData.ticketTypes,
//             ageRestriction: formData.ageRestriction,
//             promoCode: formData.promoCode,
//             offerPromo: formData.offerPromo,
//             marketingSupport: formData.marketingSupport,
//             frontPageAd: formData.frontPageAd,
//             onsiteSupport: formData.onsiteSupport
//           }
//         })
//       })

//       const data = await response.json()

//       if (!response.ok) {
//         throw new Error(data.message || 'Failed to register')
//       }

//       // Store the token and organizer data
//       localStorage.setItem('token', data.token)
//       localStorage.setItem('organizer', JSON.stringify(data.organizer))
//       localStorage.setItem('userId', data.organizer._id)
//       localStorage.setItem('userRole', 'organizer')

//       toast.success('Registration successful!')
//       setOpenDialog(false)
//       router.push('/organizer/events')
//     } catch (error) {
//       console.error('Registration error:', error)
//       toast.error(error instanceof Error ? error.message : 'Failed to register')
//     } finally {
//       setIsLoading(false)
//     }
//   }

//   const renderStepContent = () => {
//     switch (activeStep) {
//       case 0:
//         return (
//           <div className="flex flex-col gap-8 p-8">
//             <div className="text-center space-y-3">
//               <h2 className="text-2xl font-bold text-[#4D4D4D]">Enter Basic Information</h2>
//               <p className="text-[#717171]">Let's start with your organization details</p>
//             </div>
//             <div className="space-y-6">
//               <div className="relative">
//                 <Input
//                   placeholder="Organizer / Company name"
//                   value={formData.organizerName}
//                   onChange={(e) => updateFormData("organizerName", e.target.value)}
//                   className="h-14 text-base pl-4 border-2 border-gray-200 focus:border-[#115db1] rounded-xl transition-all duration-300 shadow-sm hover:shadow-md"
//                 />
//               </div>
//               <div className="relative">
//                 <Input
//                   placeholder="Contact Person"
//                   value={formData.contactPerson}
//                   onChange={(e) => updateFormData("contactPerson", e.target.value)}
//                   className="h-14 text-base pl-4 border-2 border-gray-200 focus:border-[#115db1] rounded-xl transition-all duration-300 shadow-sm hover:shadow-md"
//                 />
//               </div>
//               <div className="relative">
//                 <Input
//                   placeholder="Phone number"
//                   value={formData.phoneNumber}
//                   onChange={(e) => updateFormData("phoneNumber", e.target.value)}
//                   className="h-14 text-base pl-4 border-2 border-gray-200 focus:border-[#115db1] rounded-xl transition-all duration-300 shadow-sm hover:shadow-md"
//                 />
//               </div>
//               <div className="relative">
//                 <Input
//                   placeholder="Email"
//                   type="email"
//                   value={formData.email}
//                   onChange={(e) => updateFormData("email", e.target.value)}
//                   className="h-14 text-base pl-4 border-2 border-gray-200 focus:border-[#115db1] rounded-xl transition-all duration-300 shadow-sm hover:shadow-md"
//                 />
//               </div>
//               <div className="relative">
//                 <Input
//                   placeholder="Password"
//                   type={showPassword ? "text" : "password"}
//                   value={formData.password}
//                   onChange={(e) => updateFormData("password", e.target.value)}
//                   className="h-14 text-base pl-4 pr-12 border-2 border-gray-200 focus:border-[#115db1] rounded-xl transition-all duration-300 shadow-sm hover:shadow-md"
//                 />
//                 <button
//                   type="button"
//                   onClick={() => setShowPassword(!showPassword)}
//                   className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
//                 >
//                   {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
//                 </button>
//               </div>
//             </div>
//             <div className="flex justify-end pt-6">
//               <Button
//                 onClick={handleNext}
//                 className="bg-[#115db1] hover:bg-[#0d4a8f] px-10 py-4 rounded-xl text-white font-semibold shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105"
//               >
//                 Agree and Continue
//                 <ChevronRight className="ml-2 w-5 h-5" />
//               </Button>
//             </div>
//           </div>
//         )

//       case 1:
//         return (
//           <div className="flex flex-col gap-8 p-8">
//             <div className="text-center space-y-3">
//               <h2 className="text-2xl font-bold text-[#4D4D4D]">Enter Event Details</h2>
//               <p className="text-[#717171]">Tell us about your amazing event</p>
//             </div>
//             <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
//               <div className="space-y-6">
//                 <Input
//                   placeholder="Event Name"
//                   value={formData.eventName}
//                   onChange={(e) => updateFormData("eventName", e.target.value)}
//                   className="h-14 text-base border-2 border-gray-200 focus:border-[#115db1] rounded-xl transition-all duration-300 shadow-sm hover:shadow-md"
//                 />
//                 <Input
//                   placeholder="Event Type"
//                   value={formData.eventType}
//                   onChange={(e) => updateFormData("eventType", e.target.value)}
//                   className="h-14 text-base border-2 border-gray-200 focus:border-[#115db1] rounded-xl transition-all duration-300 shadow-sm hover:shadow-md"
//                 />
//                 <Textarea
//                   placeholder="Event Description"
//                   className="h-36 text-base resize-none border-2 border-gray-200 focus:border-[#115db1] rounded-xl transition-all duration-300 shadow-sm hover:shadow-md"
//                   value={formData.eventDescription}
//                   onChange={(e) => updateFormData("eventDescription", e.target.value)}
//                 />
//               </div>
//               <div className="space-y-6">
//                 <Input
//                   type="datetime-local"
//                   value={formData.eventDateTime}
//                   onChange={(e) => updateFormData("eventDateTime", e.target.value)}
//                   className="h-14 text-base border-2 border-gray-200 focus:border-[#115db1] rounded-xl transition-all duration-300 shadow-sm hover:shadow-md"
//                 />
//                 <Input
//                   placeholder="Event Location"
//                   value={formData.eventLocation}
//                   onChange={(e) => updateFormData("eventLocation", e.target.value)}
//                   className="h-14 text-base border-2 border-gray-200 focus:border-[#115db1] rounded-xl transition-all duration-300 shadow-sm hover:shadow-md"
//                 />
//                 <Input
//                   type="number"
//                   placeholder="Expected Attendees"
//                   value={formData.expectedAttendees}
//                   onChange={(e) => updateFormData("expectedAttendees", e.target.value)}
//                   className="h-14 text-base border-2 border-gray-200 focus:border-[#115db1] rounded-xl transition-all duration-300 shadow-sm hover:shadow-md"
//                 />
//               </div>
//             </div>
//             <div className="flex justify-end pt-6">
//               <Button
//                 onClick={handleNext}
//                 className="bg-[#115db1] hover:bg-[#0d4a8f] px-10 py-4 rounded-xl text-white font-semibold shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105"
//               >
//                 Continue
//                 <ChevronRight className="ml-2 w-5 h-5" />
//               </Button>
//             </div>
//           </div>
//         )

//       case 2:
//         return (
//           <div className="flex flex-col gap-8 p-8">
//             <div className="text-center space-y-3">
//               <h2 className="text-2xl font-bold text-[#4D4D4D]">Enter Event Details</h2>
//               <p className="text-[#717171]">Configure your ticket types and restrictions</p>
//             </div>
//             <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
//               <div className="space-y-8">
//                 <div className="bg-[#F5F7FA] p-8 rounded-2xl border border-gray-100 shadow-sm">
//                   <h3 className="text-lg font-semibold mb-6 text-[#4D4D4D] flex items-center">
//                     <Sparkles className="mr-3 w-5 h-5 text-[#115db1]" />
//                     What type of tickets are you offering?
//                   </h3>
//                   <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
//                     {["Regular", "VIP", "VVIP", "Early Bird", "Bundle Tick"].map((type) => (
//                       <Button
//                         key={type}
//                         variant="outline"
//                         className={`h-12 text-sm rounded-xl transition-all duration-300 font-medium ${
//                           formData.ticketTypes[type.toLowerCase().replace(" ", "") as keyof typeof formData.ticketTypes]
//                             ? "bg-[#115db1] text-white border-[#115db1] shadow-lg transform scale-105"
//                             : "bg-white text-[#717171] border-gray-300 hover:border-[#115db1] hover:shadow-md hover:text-[#115db1]"
//                         }`}
//                         onClick={() => {
//                           const key = type.toLowerCase().replace(" ", "") as keyof typeof formData.ticketTypes
//                           updateFormData("ticketTypes", {
//                             ...formData.ticketTypes,
//                             [key]: !formData.ticketTypes[key],
//                           })
//                         }}
//                       >
//                         {type}
//                       </Button>
//                     ))}
//                   </div>
//                 </div>

//                 <div className="bg-[#F5F7FA] p-8 rounded-2xl border border-gray-100 shadow-sm">
//                   <h3 className="text-lg font-semibold mb-6 text-[#4D4D4D] flex items-center">
//                     <Shield className="mr-3 w-5 h-5 text-[#115db1]" />
//                     Age Restriction?
//                   </h3>
//                   <div className="space-y-4">
//                     <div className="flex items-center space-x-3">
//                       <Checkbox
//                         id="age-restriction"
//                         className="w-5 h-5 rounded-md border-2 data-[state=checked]:bg-[#115db1] data-[state=checked]:border-[#115db1]"
//                       />
//                       <label htmlFor="age-restriction" className="text-base text-[#4D4D4D] font-medium">
//                         Does your event have an age restriction?
//                       </label>
//                     </div>
//                     <div className="flex items-center space-x-3">
//                       <Checkbox
//                         id="no-restriction"
//                         className="w-5 h-5 rounded-md border-2 data-[state=checked]:bg-[#115db1] data-[state=checked]:border-[#115db1]"
//                       />
//                       <label htmlFor="no-restriction" className="text-base text-[#4D4D4D] font-medium">
//                         No
//                       </label>
//                     </div>
//                   </div>
//                   <div className="grid grid-cols-4 md:grid-cols-7 gap-3 mt-6">
//                     {["3+", "7+", "13+", "16+", "18+", "21+", "25+"].map((age) => (
//                       <div key={age} className="flex items-center space-x-2">
//                         <Checkbox
//                           id={age}
//                           className="w-4 h-4 rounded-md border-2 data-[state=checked]:bg-[#115db1] data-[state=checked]:border-[#115db1]"
//                         />
//                         <label htmlFor={age} className="text-sm text-[#717171]">
//                           {age}
//                         </label>
//                       </div>
//                     ))}
//                   </div>
//                 </div>
//               </div>

//               <div className="space-y-8">
//                 <div className="bg-[#F5F7FA] p-8 rounded-2xl border border-gray-100 shadow-sm">
//                   <h3 className="text-lg font-semibold mb-6 text-[#4D4D4D] flex items-center">
//                     <TrendingUp className="mr-3 w-5 h-5 text-[#115db1]" />
//                     Discount / Promotion
//                   </h3>
//                   <p className="text-base text-[#717171] mb-6">Will you offer Promo codes</p>
//                   <div className="space-y-4">
//                     <div className="flex items-center space-x-3">
//                       <Checkbox
//                         id="promo-yes"
//                         checked={formData.offerPromo}
//                         onCheckedChange={(checked) => updateFormData("offerPromo", checked)}
//                         className="w-5 h-5 rounded-md border-2 data-[state=checked]:bg-[#115db1] data-[state=checked]:border-[#115db1]"
//                       />
//                       <label htmlFor="promo-yes" className="text-base text-[#4D4D4D] font-medium">
//                         Yes
//                       </label>
//                     </div>
//                     <div className="flex items-center space-x-3">
//                       <Checkbox
//                         id="promo-no"
//                         checked={!formData.offerPromo}
//                         onCheckedChange={(checked) => updateFormData("offerPromo", !checked)}
//                         className="w-5 h-5 rounded-md border-2 data-[state=checked]:bg-[#115db1] data-[state=checked]:border-[#115db1]"
//                       />
//                       <label htmlFor="promo-no" className="text-base text-[#4D4D4D] font-medium">
//                         No
//                       </label>
//                     </div>
//                     <Input
//                       placeholder="Promo Code"
//                       className="h-12 text-base mt-6 border-2 border-gray-200 focus:border-[#115db1] rounded-xl transition-all duration-300 shadow-sm hover:shadow-md"
//                       value={formData.promoCode}
//                       onChange={(e) => updateFormData("promoCode", e.target.value)}
//                     />
//                   </div>
//                 </div>
//               </div>
//             </div>
//             <div className="flex justify-center pt-8">
//               <Button
//                 onClick={handleNext}
//                 className="bg-[#115db1] hover:bg-[#0d4a8f] px-16 py-4 text-base rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105"
//               >
//                 Continue
//                 <ChevronRight className="ml-2 w-5 h-5" />
//               </Button>
//             </div>
//           </div>
//         )

//       case 3:
//         return (
//           <div className="flex flex-col gap-8 p-8">
//             <div className="text-center space-y-3">
//               <h2 className="text-2xl font-bold text-[#4D4D4D]">Enter Additional Information</h2>
//               <p className="text-[#717171]">Choose additional services to enhance your event</p>
//             </div>
//             <div className="space-y-8">
//               <div className="bg-[#F5F7FA] p-8 rounded-2xl border border-gray-100 shadow-sm">
//                 <h3 className="text-lg font-semibold mb-4 text-[#4D4D4D] flex items-center">
//                   <Zap className="mr-3 w-5 h-5 text-[#115db1]" />
//                   Marketing Support?
//                 </h3>
//                 <p className="text-[#717171] mb-6">
//                   (We can help you promote the event through social media and email campaigns)
//                 </p>
//                 <div className="space-y-3">
//                   <div className="flex items-center space-x-3">
//                     <Checkbox
//                       id="marketing-yes"
//                       checked={formData.marketingSupport}
//                       onCheckedChange={(checked) => updateFormData("marketingSupport", checked)}
//                       className="w-5 h-5 rounded-md border-2 data-[state=checked]:bg-[#115db1] data-[state=checked]:border-[#115db1]"
//                     />
//                     <label htmlFor="marketing-yes" className="text-base text-[#4D4D4D] font-medium">
//                       Yes
//                     </label>
//                   </div>
//                   <div className="flex items-center space-x-3">
//                     <Checkbox
//                       id="marketing-no"
//                       checked={!formData.marketingSupport}
//                       onCheckedChange={(checked) => updateFormData("marketingSupport", !checked)}
//                       className="w-5 h-5 rounded-md border-2 data-[state=checked]:bg-[#115db1] data-[state=checked]:border-[#115db1]"
//                     />
//                     <label htmlFor="marketing-no" className="text-base text-[#4D4D4D] font-medium">
//                       No
//                     </label>
//                   </div>
//                 </div>
//               </div>

//               <div className="bg-[#F5F7FA] p-8 rounded-2xl border border-gray-100 shadow-sm">
//                 <h3 className="text-lg font-semibold mb-4 text-[#4D4D4D] flex items-center">
//                   <Sparkles className="mr-3 w-5 h-5 text-[#115db1]" />
//                   Request Exposure through Front Page Advertising
//                 </h3>
//                 <div className="space-y-3">
//                   <div className="flex items-center space-x-3">
//                     <Checkbox
//                       id="frontpage-yes"
//                       checked={formData.frontPageAd}
//                       onCheckedChange={(checked) => updateFormData("frontPageAd", checked)}
//                       className="w-5 h-5 rounded-md border-2 data-[state=checked]:bg-[#115db1] data-[state=checked]:border-[#115db1]"
//                     />
//                     <label htmlFor="frontpage-yes" className="text-base text-[#4D4D4D] font-medium">
//                       Yes
//                     </label>
//                   </div>
//                   <div className="flex items-center space-x-3">
//                     <Checkbox
//                       id="frontpage-no"
//                       checked={!formData.frontPageAd}
//                       onCheckedChange={(checked) => updateFormData("frontPageAd", !checked)}
//                       className="w-5 h-5 rounded-md border-2 data-[state=checked]:bg-[#115db1] data-[state=checked]:border-[#115db1]"
//                     />
//                     <label htmlFor="frontpage-no" className="text-base text-[#4D4D4D] font-medium">
//                       No
//                     </label>
//                   </div>
//                 </div>
//               </div>

//               <div className="bg-[#F5F7FA] p-8 rounded-2xl border border-gray-100 shadow-sm">
//                 <h3 className="text-lg font-semibold mb-4 text-[#4D4D4D] flex items-center">
//                   <Users className="mr-3 w-5 h-5 text-[#115db1]" />
//                   Onsite Support? (Will you need help managing your event?)
//                 </h3>
//                 <div className="space-y-3">
//                   <div className="flex items-center space-x-3">
//                     <Checkbox
//                       id="onsite-yes"
//                       checked={formData.onsiteSupport}
//                       onCheckedChange={(checked) => updateFormData("onsiteSupport", checked)}
//                       className="w-5 h-5 rounded-md border-2 data-[state=checked]:bg-[#115db1] data-[state=checked]:border-[#115db1]"
//                     />
//                     <label htmlFor="onsite-yes" className="text-base text-[#4D4D4D] font-medium">
//                       Yes
//                     </label>
//                   </div>
//                   <div className="flex items-center space-x-3">
//                     <Checkbox
//                       id="onsite-no"
//                       checked={!formData.onsiteSupport}
//                       onCheckedChange={(checked) => updateFormData("onsiteSupport", !checked)}
//                       className="w-5 h-5 rounded-md border-2 data-[state=checked]:bg-[#115db1] data-[state=checked]:border-[#115db1]"
//                     />
//                     <label htmlFor="onsite-no" className="text-base text-[#4D4D4D] font-medium">
//                       No
//                     </label>
//                   </div>
//                 </div>
//               </div>
//             </div>
//             <div className="flex justify-center pt-8">
//               <Button 
//                 onClick={handleSubmit}
//                 disabled={isLoading}
//                 className="bg-[#115db1] hover:bg-[#0d4a8f] px-16 py-4 text-base rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105"
//               >
//                 {isLoading ? (
//                   <div className="flex items-center gap-2">
//                     <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
//                     Submitting...
//                   </div>
//                 ) : (
//                   <>
//                     <CheckCircle className="mr-2 w-5 h-5" />
//                     Submit
//                   </>
//                 )}
//               </Button>
//             </div>
//           </div>
//         )

//       default:
//         return null
//     }
//   }

//   return (
//     <div className="min-h-screen bg-white">
//       {/* Registration Dialog */}
//       <Dialog open={openDialog} onOpenChange={setOpenDialog}>
//         <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto border-0 shadow-2xl rounded-3xl">
//           <DialogHeader className="pb-6">
//             <DialogTitle className="text-3xl font-bold text-center text-[#4D4D4D] uppercase tracking-wide">
//               Organizer Registration
//             </DialogTitle>
//           </DialogHeader>

//           {/* Desktop Stepper */}
//           <div className="hidden md:flex justify-between mb-8 px-4">
//             {steps.map((step, index) => (
//               <div
//                 key={step}
//                 className={`flex-1 text-center cursor-pointer transition-all duration-300 ${
//                   index <= activeStep ? "text-[#115db1]" : "text-gray-400"
//                 }`}
//                 onClick={() => handleStepClick(index)}
//               >
//                 <div
//                   className={`w-10 h-10 rounded-full mx-auto mb-3 flex items-center justify-center font-semibold transition-all duration-300 ${
//                     index <= activeStep
//                       ? "bg-[#115db1] text-white shadow-lg transform scale-110"
//                       : "bg-gray-200 text-gray-500"
//                   }`}
//                 >
//                   {index < activeStep ? <CheckCircle className="w-5 h-5" /> : index + 1}
//                 </div>
//                 <div className="text-sm font-medium">{step}</div>
//                 {index < steps.length - 1 && (
//                   <div
//                     className={`h-1 mt-2 mx-4 rounded-full transition-all duration-300 ${
//                       index < activeStep ? "bg-[#115db1]" : "bg-gray-200"
//                     }`}
//                   />
//                 )}
//               </div>
//             ))}
//           </div>

//           {/* Mobile Navigation */}
//           <div className="flex md:hidden justify-between items-center mb-6 px-4">
//             <Button variant="outline" size="sm" onClick={handleBack} disabled={activeStep === 0} className="rounded-xl">
//               <ChevronLeft className="w-4 h-4 mr-1" />
//               Back
//             </Button>
//             <div className="flex space-x-2">
//               {steps.map((_, index) => (
//                 <div
//                   key={index}
//                   className={`w-3 h-3 rounded-full transition-all duration-300 ${
//                     index === activeStep
//                       ? "bg-[#115db1] transform scale-125"
//                       : index < activeStep
//                         ? "bg-[#115db1] opacity-60"
//                         : "bg-gray-300"
//                   }`}
//                 />
//               ))}
//             </div>
//             <Button
//               variant="outline"
//               size="sm"
//               onClick={handleNext}
//               disabled={activeStep === steps.length - 1}
//               className="rounded-xl"
//             >
//               Next
//               <ChevronRight className="w-4 h-4 ml-1" />
//             </Button>
//           </div>

//           {renderStepContent()}
//         </DialogContent>
//       </Dialog>

//       {/* Hero Section */}
//       <section className="bg-[#F5F7FA] px-4 md:px-20 py-24">
//         <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center gap-12">
//           <div className="flex-1 space-y-8">
//             <div className="space-y-6">
//               <h1 className="text-5xl md:text-6xl font-bold text-[#4D4D4D] leading-tight">
//                 Sell Tickets to Your Events <span className="text-[#115db1]">Hassle Free.</span>
//               </h1>
//               <p className="text-xl text-[#717171] leading-relaxed">
//                 Reach Thousands of Attendees & Grow Your Events with Pazimo Ticketing Platform.
//               </p>
//             </div>
//             <div className="flex flex-col sm:flex-row gap-4">
//               <Button
//                 onClick={() => setOpenDialog(true)}
//                 className="bg-[#115db1] hover:bg-[#0d4a8f] px-10 py-4 text-lg rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105"
//               >
//                 <Sparkles className="mr-2 w-5 h-5" />
//                 Get Started
//               </Button>
//               <Button
//                 variant="outline"
//                 className="px-10 py-4 text-lg rounded-xl font-semibold border-2 border-[#115db1] text-[#115db1] hover:bg-[#115db1] hover:text-white transition-all duration-300"
//               >
//                 Learn More
//               </Button>
//             </div>
//           </div>
//           <div className="flex-1">
//             <div className="relative">
//               <div className="absolute inset-0 bg-[#115db1] rounded-3xl blur-3xl opacity-10 transform rotate-6" />
//               <Image
//                 src="/images/organizer_banner.png"
//                 alt="Event organizer banner"
//                 width={500}
//                 height={400}
//                 className="relative w-full h-auto rounded-2xl shadow-2xl"
//               />
//             </div>
//           </div>
//         </div>
//       </section>

//       {/* Why Choose Pazimo */}
//       <section className="py-24 px-4">
//         <div className="max-w-7xl mx-auto text-center">
//           <div className="mb-16">
//             <h2 className="text-4xl md:text-5xl font-bold text-[#4D4D4D] mb-6">
//               Why Choose <span className="text-[#115db1]">Pazimo?</span>
//             </h2>
//             <p className="text-xl text-[#717171] max-w-2xl mx-auto">The smart choice for Event Organizers</p>
//           </div>

//           <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
//             <Card className="group border-0 shadow-xl hover:shadow-2xl transition-all duration-500 transform hover:-translate-y-2">
//               <CardContent className="p-8 text-center space-y-6">
//                 <div className="bg-[#115DB199] rounded-2xl p-6 w-fit mx-auto shadow-lg group-hover:shadow-xl transition-all duration-300 transform group-hover:scale-110">
//                   <Image src="/images/organizer_clock.png" alt="Clock" width={32} height={32} />
//                 </div>
//                 <h3 className="text-2xl font-bold text-[#4D4D4D]">Easy Application Process</h3>
//                 <p className="text-[#717171] leading-relaxed">
//                   Submit basic details, get verified fast, and access our secure dashboard instantly.
//                 </p>
//               </CardContent>
//             </Card>

//             <Card className="group border-0 shadow-xl hover:shadow-2xl transition-all duration-500 transform hover:-translate-y-2">
//               <CardContent className="p-8 text-center space-y-6">
//                 <div className="bg-[#115DB199] rounded-2xl p-6 w-fit mx-auto shadow-lg group-hover:shadow-xl transition-all duration-300 transform group-hover:scale-110">
//                   <Image src="/images/organizer_chart.png" alt="Chart" width={32} height={32} />
//                 </div>
//                 <h3 className="text-2xl font-bold text-[#4D4D4D]">Maximum Exposure</h3>
//                 <p className="text-[#717171] leading-relaxed">
//                   Pazimo boosts your event with maximum exposure reach more attendees, sell more tickets, and grow your
//                   audience effortlessly.
//                 </p>
//               </CardContent>
//             </Card>

//             <Card className="group border-0 shadow-xl hover:shadow-2xl transition-all duration-500 transform hover:-translate-y-2">
//               <CardContent className="p-8 text-center space-y-6">
//                 <div className="bg-[#115DB199] rounded-2xl p-6 w-fit mx-auto shadow-lg group-hover:shadow-xl transition-all duration-300 transform group-hover:scale-110">
//                   <Image src="/images/organizer_lock.png" alt="Lock" width={32} height={32} />
//                 </div>
//                 <h3 className="text-2xl font-bold text-[#4D4D4D]">Secure & Reliable</h3>
//                 <p className="text-[#717171] leading-relaxed">
//                   Sell with zero stress. Pazimo's fraud-proof system guarantees secure transactions & 99.9% uptime.
//                 </p>
//               </CardContent>
//             </Card>
//           </div>
//         </div>
//       </section>

//       {/* How to Apply */}
//       <section className="py-24 px-4 bg-[#F5F7FA]">
//         <div className="max-w-7xl mx-auto flex flex-col lg:flex-row items-center gap-16">
//           <div className="flex-1">
//             <div className="relative">
//               <div className="absolute inset-0 bg-[#115db1] rounded-3xl blur-3xl opacity-10 transform -rotate-6" />
//               <Image
//                 src="/images/organizer_illustration1.png"
//                 alt="How to apply illustration"
//                 width={500}
//                 height={400}
//                 className="relative w-full h-auto rounded-2xl shadow-2xl"
//               />
//             </div>
//           </div>
//           <div className="flex-1 space-y-8">
//             <div className="space-y-6">
//               <h2 className="text-4xl md:text-5xl font-bold text-[#4D4D4D] leading-tight">
//                 How to Apply as an <span className="text-[#115db1]">Event Organizer</span>
//               </h2>
//               <p className="text-lg text-[#717171] leading-relaxed">
//                 Applying as an event organizer on Pazimo is quick and effortless! Simply sign up with your basic
//                 details, verify your account in minutes, and get instant access to your secure dashboard. Upload your
//                 event info, set up tickets, and connect your preferred payment method all in just a few clicks.
//               </p>
//             </div>

//             <div className="space-y-4">
//               <div className="flex items-start gap-4 p-4 bg-white rounded-xl shadow-md hover:shadow-lg transition-all duration-300">
//                 <div className="bg-[#115db1] rounded-full p-2 flex-shrink-0">
//                   <CheckCircle className="w-5 h-5 text-white" />
//                 </div>
//                 <div>
//                   <h4 className="font-semibold text-[#4D4D4D]">Automated approval process</h4>
//                   <p className="text-[#717171]">No long waits, start selling tickets right away</p>
//                 </div>
//               </div>

//               <div className="flex items-start gap-4 p-4 bg-white rounded-xl shadow-md hover:shadow-lg transition-all duration-300">
//                 <div className="bg-[#115db1] rounded-full p-2 flex-shrink-0">
//                   <CheckCircle className="w-5 h-5 text-white" />
//                 </div>
//                 <div>
//                   <h4 className="font-semibold text-[#4D4D4D]">24/7 support team</h4>
//                   <p className="text-[#717171]">Ready to help if you need assistance</p>
//                 </div>
//               </div>

//               <div className="flex items-start gap-4 p-4 bg-white rounded-xl shadow-md hover:shadow-lg transition-all duration-300">
//                 <div className="bg-[#115db1] rounded-full p-2 flex-shrink-0">
//                   <CheckCircle className="w-5 h-5 text-white" />
//                 </div>
//                 <div>
//                   <h4 className="font-semibold text-[#4D4D4D]">Fast, secure, and hassle-free</h4>
//                   <p className="text-[#717171]">From sign-up to your first sale</p>
//                 </div>
//               </div>
//             </div>

//             <Button
//               onClick={() => setOpenDialog(true)}
//               className="bg-[#115db1] hover:bg-[#0d4a8f] px-10 py-4 text-lg rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105"
//             >
//               Register Now
//             </Button>
//           </div>
//         </div>
//       </section>

//       {/* Statistics */}
//       <section className="bg-[#115DB1] text-white py-20 px-4 relative overflow-hidden">
//         <div className="absolute inset-0 bg-black/5" />
//         <div className="relative max-w-7xl mx-auto">
//           <div className="text-center mb-16">
//             <h2 className="text-4xl md:text-5xl font-bold mb-6">Making Moves, Breaking Records</h2>
//             <p className="text-xl text-blue-100 max-w-2xl mx-auto">We reached here with our hard work and dedication</p>
//           </div>

//           <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
//             <div className="text-center group">
//               <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 transition-all duration-300 group-hover:bg-white/20 group-hover:transform group-hover:scale-105">
//                 <Image src="/images/organizer_Icon1.png" alt="Members" width={48} height={48} />
//                 <h3 className="text-3xl md:text-4xl font-bold mb-2">1000+</h3>
//                 <p className="text-blue-100">Members</p>
//               </div>
//             </div>
//             <div className="text-center group">
//               <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 transition-all duration-300 group-hover:bg-white/20 group-hover:transform group-hover:scale-105">
//                 <Image src="/images/organizer_Icon2.png" alt="Tickets" width={48} height={48} />
//                 <h3 className="text-3xl md:text-4xl font-bold mb-2">50+</h3>
//                 <p className="text-blue-100">Sold Tickets</p>
//               </div>
//             </div>
//             <div className="text-center group">
//               <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 transition-all duration-300 group-hover:bg-white/20 group-hover:transform group-hover:scale-105">
//                 <Image src="/images/organizer_Icon3.png" alt="Organizers" width={48} height={48} />
//                 <h3 className="text-3xl md:text-4xl font-bold mb-2">25</h3>
//                 <p className="text-blue-100">Organizers</p>
//               </div>
//             </div>
//             <div className="text-center group">
//               <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 transition-all duration-300 group-hover:bg-white/20 group-hover:transform group-hover:scale-105">
//                 <CreditCard className="w-12 h-12 mx-auto mb-4 text-white" />
//                 <h3 className="text-3xl md:text-4xl font-bold mb-2">25,000+</h3>
//                 <p className="text-blue-100">Transactions in ETB</p>
//               </div>
//             </div>
//           </div>
//         </div>
//       </section>

//       {/* Security Section */}
//       <section className="py-24 px-4">
//         <div className="max-w-7xl mx-auto flex flex-col lg:flex-row items-center gap-16">
//           <div className="flex-1">
//             <div className="relative">
//               <div className="absolute inset-0 bg-[#115db1] rounded-3xl blur-3xl opacity-10 transform rotate-6" />
//               <Image
//                 src="/images/organizer_illustration2.png"
//                 alt="Security illustration"
//                 width={500}
//                 height={400}
//                 className="relative w-full h-auto rounded-2xl shadow-2xl"
//               />
//             </div>
//           </div>
//           <div className="flex-1 space-y-8">
//             <div className="space-y-6">
//               <h2 className="text-4xl md:text-5xl font-bold text-[#4D4D4D] leading-tight">
//                 <span className="text-[#115db1]">Secure Transactions,</span>
//                 <br />
//                 Smooth Experience
//               </h2>
//               <p className="text-lg text-[#717171] leading-relaxed">
//                 At Pazimo, security is our top priority. We understand the importance of keeping your data and
//                 transactions safe, which is why we implement advanced encryption protocols, multi-layered
//                 authentication, and continuous monitoring to protect both organizers and attendees.
//               </p>
//             </div>

//             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
//               <div className="bg-[#F5F7FA] p-6 rounded-xl border border-gray-100 hover:shadow-lg transition-all duration-300">
//                 <Shield className="w-8 h-8 text-[#115db1] mb-4" />
//                 <h4 className="font-semibold text-[#4D4D4D] mb-2">Advanced Encryption</h4>
//                 <p className="text-[#717171] text-sm">Bank-level security protocols</p>
//               </div>

//               <div className="bg-[#F5F7FA] p-6 rounded-xl border border-gray-100 hover:shadow-lg transition-all duration-300">
//                 <Zap className="w-8 h-8 text-[#115db1] mb-4" />
//                 <h4 className="font-semibold text-[#4D4D4D] mb-2">Real-time Processing</h4>
//                 <p className="text-[#717171] text-sm">Instant payment confirmation</p>
//               </div>

//               <div className="bg-[#F5F7FA] p-6 rounded-xl border border-gray-100 hover:shadow-lg transition-all duration-300">
//                 <Users className="w-8 h-8 text-[#115db1] mb-4" />
//                 <h4 className="font-semibold text-[#4D4D4D] mb-2">Multiple Payment Gateways</h4>
//                 <p className="text-[#717171] text-sm">Flexible payment options</p>
//               </div>

//               <div className="bg-[#F5F7FA] p-6 rounded-xl border border-gray-100 hover:shadow-lg transition-all duration-300">
//                 <TrendingUp className="w-8 h-8 text-[#115db1] mb-4" />
//                 <h4 className="font-semibold text-[#4D4D4D] mb-2">99.9% Uptime</h4>
//                 <p className="text-[#717171] text-sm">Reliable service guarantee</p>
//               </div>
//             </div>
//           </div>
//         </div>
//       </section>

//       {/* How It Works */}
//       <section className="py-24 px-4 bg-[#F5F7FA]">
//         <div className="max-w-7xl mx-auto text-center">
//           <div className="mb-16">
//             <h2 className="text-4xl md:text-5xl font-bold text-[#4D4D4D] mb-6">
//               How does it <span className="text-[#115db1]">work?</span>
//             </h2>
//             <p className="text-xl text-[#717171] max-w-4xl mx-auto leading-relaxed mb-8">
//               Applying as an event organizer on Pazimo is quick and effortless! Simply sign up with your basic details,
//               verify your account in minutes, and get instant access to your secure dashboard.
//             </p>
//             <div className="inline-flex items-center gap-4 bg-white rounded-2xl px-8 py-4 shadow-lg">
//               <span className="text-lg font-semibold text-[#4D4D4D]">Sign up</span>
//               <ChevronRight className="w-5 h-5 text-[#717171]" />
//               <span className="text-lg font-semibold text-[#4D4D4D]">Pay how you want</span>
//               <ChevronRight className="w-5 h-5 text-[#717171]" />
//               <span className="text-lg font-semibold text-[#4D4D4D]">QR entry</span>
//               <span className="text-lg font-bold text-[#115db1]">Done!</span>
//             </div>
//           </div>

//           <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
//             <div className="group text-center space-y-6">
//               <div className="relative">
//                 <div className="absolute inset-0 bg-[#115db1] rounded-3xl blur-2xl opacity-10 transform group-hover:scale-110 transition-all duration-300" />
//                 <div className="relative bg-white rounded-2xl p-8 shadow-xl group-hover:shadow-2xl transition-all duration-300 transform group-hover:-translate-y-2">
//                   <Image
//                     src="/images/organizer_phone1.png"
//                     alt="Sign up"
//                     width={110}
//                     height={200}
//                     className="mx-auto"
//                   />
//                 </div>
//               </div>
//               <div className="space-y-3">
//                 <h3 className="text-xl font-bold text-[#4D4D4D]">Sign up in seconds</h3>
//                 <p className="text-[#717171]">Just email & basic details.</p>
//               </div>
//             </div>

//             <div className="group text-center space-y-6">
//               <div className="relative">
//                 <div className="absolute inset-0 bg-[#115db1] rounded-3xl blur-2xl opacity-10 transform group-hover:scale-110 transition-all duration-300" />
//                 <div className="relative bg-white rounded-2xl p-8 shadow-xl group-hover:shadow-2xl transition-all duration-300 transform group-hover:-translate-y-2">
//                   <Image
//                     src="/images/organizer_phone2.png"
//                     alt="Payment"
//                     width={110}
//                     height={200}
//                     className="mx-auto"
//                   />
//                 </div>
//               </div>
//               <div className="space-y-3">
//                 <h3 className="text-xl font-bold text-[#4D4D4D]">Attendees pay safely</h3>
//                 <p className="text-[#717171]">Via Telebirr, CBE, or more</p>
//               </div>
//             </div>

//             <div className="group text-center space-y-6">
//               <div className="relative">
//                 <div className="absolute inset-0 bg-[#115db1] rounded-3xl blur-2xl opacity-10 transform group-hover:scale-110 transition-all duration-300" />
//                 <div className="relative bg-white rounded-2xl p-8 shadow-xl group-hover:shadow-2xl transition-all duration-300 transform group-hover:-translate-y-2">
//                   <div className="w-32 h-32 mx-auto bg-[#115DB1] rounded-2xl flex items-center justify-center shadow-lg">
//                     <div className="w-24 h-24 bg-white rounded-xl grid grid-cols-4 gap-1 p-3">
//                       {Array.from({ length: 16 }).map((_, i) => (
//                         <div key={i} className="bg-[#4D4D4D] rounded-sm" />
//                       ))}
//                     </div>
//                   </div>
//                 </div>
//               </div>
//               <div className="space-y-3">
//                 <h3 className="text-xl font-bold text-[#4D4D4D]">Unique QR codes</h3>
//                 <p className="text-[#717171]">Sent instantly scan at entry for fast check-in</p>
//               </div>
//             </div>
//           </div>
//         </div>
//       </section>

//       {/* Commission */}
//       <section className="py-24 px-4">
//         <div className="max-w-7xl mx-auto">
//           <div className="text-center mb-16">
//             <h2 className="text-4xl md:text-5xl font-bold text-[#4D4D4D] mb-6">
//               Transparent & Fair <span className="text-[#115db1]">Commission</span>
//             </h2>
//             <p className="text-xl text-[#717171] max-w-4xl mx-auto">
//               Only 5% per ticket guaranteed. No hidden fees, no last-minute charges, no surprises. With Pazimo's
//               industry-low flat rate, you keep more of your hard earned revenue while we handle payments, security, and
//               support. What you see is what you pay always.
//             </p>
//           </div>

//           <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
//             <div className="space-y-6">
//               <div className="flex items-start gap-4 p-6 bg-[#F5F7FA] rounded-xl border border-gray-100 hover:shadow-lg transition-all duration-300">
//                 <Image src="/images/tick.png" alt="Check" width={24} height={24} className="flex-shrink-0" />
//                 <div>
//                   <span className="font-semibold text-[#4D4D4D]">Locked-in rate promise: </span>
//                   <span className="text-[#717171]">
//                     Your commission never increases, no matter how big your event grows.
//                   </span>
//                 </div>
//               </div>
//               <div className="flex items-start gap-4 p-6 bg-[#F5F7FA] rounded-xl border border-gray-100 hover:shadow-lg transition-all duration-300">
//                 <Image src="/images/tick.png" alt="Check" width={24} height={24} className="flex-shrink-0" />
//                 <div>
//                   <span className="font-semibold text-[#4D4D4D]">Compare and save: </span>
//                   <span className="text-[#717171]">
//                     Other platforms charge 7-10%—we keep it fair at just 5%, forever.
//                   </span>
//                 </div>
//               </div>
//             </div>

//             <div className="bg-[#115DB1] text-white p-8 rounded-2xl shadow-2xl">
//               <h3 className="text-3xl font-bold mb-8 text-center">Pricing Calculator</h3>
//               <div className="space-y-6">
//                 <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 text-center">
//                   <div className="text-4xl font-bold mb-2">5%</div>
//                   <div className="text-blue-100">Commission Rate</div>
//                 </div>
//                 <div className="space-y-4">
//                   <div className="flex justify-between items-center">
//                     <span>Ticket Price:</span>
//                     <span className="font-semibold">$50</span>
//                   </div>
//                   <div className="flex justify-between items-center">
//                     <span>Our Fee:</span>
//                     <span className="font-semibold">$2.50</span>
//                   </div>
//                   <div className="border-t border-white/20 pt-4">
//                     <div className="flex justify-between items-center text-lg font-bold">
//                       <span>You Keep:</span>
//                       <span>$47.50</span>
//                     </div>
//                   </div>
//                 </div>
//               </div>
//             </div>
//           </div>
//         </div>
//       </section>

//       {/* App Download */}
//       <section className="py-24 px-4 text-center bg-[#F5F7FA]">
//         <div className="max-w-4xl mx-auto space-y-8">
//           <div className="space-y-6">
//             <h2 className="text-4xl md:text-5xl font-bold text-[#4D4D4D]">
//               Let's <span className="text-[#115db1]">Grow Together!</span>
//             </h2>
//             <p className="text-xl text-[#717171] max-w-2xl mx-auto">
//               Download the Pazimo App and join thousands of organizers building unforgettable events—while keeping more
//               of your profits.
//             </p>
//           </div>

//           <div className="flex flex-col sm:flex-row justify-center gap-6">
//             <div className="group cursor-pointer">
//               <div className="bg-white rounded-2xl p-6 shadow-lg group-hover:shadow-xl transition-all duration-300 transform group-hover:scale-105">
//                 <Image
//                   src="/images/organizer_app-store.png"
//                   alt="Download on App Store"
//                   width={180}
//                   height={60}
//                   className="cursor-pointer hover:opacity-80 transition-opacity"
//                 />
//               </div>
//             </div>
//             <div className="group cursor-pointer">
//               <div className="bg-white rounded-2xl p-6 shadow-lg group-hover:shadow-xl transition-all duration-300 transform group-hover:scale-105">
//                 <Image
//                   src="/images/organizer-playstore.png"
//                   alt="Get it on Google Play"
//                   width={180}
//                   height={60}
//                   className="cursor-pointer hover:opacity-80 transition-opacity"
//                 />
//               </div>
//             </div>
//           </div>

//           <div className="pt-8">
//             <Button
//               onClick={() => setOpenDialog(true)}
//               className="bg-[#115db1] hover:bg-[#0d4a8f] px-10 py-4 text-lg rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105"
//             >
//               <Sparkles className="mr-2 w-5 h-5" />
//               Start Your Journey Today
//             </Button>
//           </div>
//         </div>
//       </section>
//     </div>
//   )
// }


"use client"

import type React from "react"

import { useState } from "react"
import {
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Sparkles,
  Shield,
  Zap,
  Users,
  TrendingUp,
  CheckCircle,
  Eye,
  EyeOff,
  ArrowRight,
  Play,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Card, CardContent } from "@/components/ui/card"
import Image from "next/image"
import { toast } from "sonner"
import { useRouter } from "next/navigation"

const steps = ["Basic Information", "Event Registration", "Event Details", "Additional Information"]

export default function OrganizerHome() {
  const [openDialog, setOpenDialog] = useState(false)
  const [activeStep, setActiveStep] = useState(0)
  const [formData, setFormData] = useState({
    organizerName: "",
    contactPerson: "",
    phoneNumber: "",
    email: "",
    password: "",
    eventName: "",
    eventType: "",
    eventDescription: "",
    eventDateTime: "",
    eventLocation: "",
    expectedAttendees: "",
    ticketTypes: {
      regular: false,
      vip: false,
      vvip: false,
      earlyBird: false,
      bundle: false,
    },
    ageRestriction: "",
    promoCode: "",
    offerPromo: false,
    marketingSupport: false,
    frontPageAd: false,
    onsiteSupport: false,
  })
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()
  const [showPassword, setShowPassword] = useState(false)

  const handleNext = () => {
    if (activeStep < steps.length - 1) {
      setActiveStep(activeStep + 1)
    }
  }

  const handleBack = () => {
    if (activeStep > 0) {
      setActiveStep(activeStep - 1)
    }
  }

  const handleStepClick = (step: number) => {
    setActiveStep(step)
  }

  const updateFormData = (field: string, value: any) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/organizers/sign-up`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: formData.contactPerson,
          email: formData.email,
          phone: formData.phoneNumber,
          organization: formData.organizerName,
          password: formData.password || Math.random().toString(36).slice(-8),
          eventDetails: {
            eventName: formData.eventName,
            eventType: formData.eventType,
            eventDescription: formData.eventDescription,
            eventDateTime: formData.eventDateTime,
            eventLocation: formData.eventLocation,
            expectedAttendees: formData.expectedAttendees,
            ticketTypes: formData.ticketTypes,
            ageRestriction: formData.ageRestriction,
            promoCode: formData.promoCode,
            offerPromo: formData.offerPromo,
            marketingSupport: formData.marketingSupport,
            frontPageAd: formData.frontPageAd,
            onsiteSupport: formData.onsiteSupport,
          },
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || "Failed to register")
      }

      localStorage.setItem("token", data.token)
      localStorage.setItem("organizer", JSON.stringify(data.organizer))
      localStorage.setItem("userId", data.organizer._id)
      localStorage.setItem("userRole", "organizer")

      toast.success("Registration successful!")
      setOpenDialog(false)
      router.push("/organizer/events")
    } catch (error) {
      console.error("Registration error:", error)
      toast.error(error instanceof Error ? error.message : "Failed to register")
    } finally {
      setIsLoading(false)
    }
  }

  const renderStepContent = () => {
    switch (activeStep) {
      case 0:
        return (
          <div className="flex flex-col gap-8 p-8">
            <div className="text-center space-y-3">
              <h2 className="text-2xl font-bold text-gray-900">Enter Basic Information</h2>
              <p className="text-gray-600">Let's start with your organization details</p>
            </div>
            <div className="space-y-6">
              <div className="relative">
                <Input
                  placeholder="Organizer / Company name"
                  value={formData.organizerName}
                  onChange={(e) => updateFormData("organizerName", e.target.value)}
                  className="h-12 text-base pl-4 border border-gray-300 focus:border-[#115db1] focus:ring-1 focus:ring-[#115db1] rounded-lg transition-all duration-200"
                />
              </div>
              <div className="relative">
                <Input
                  placeholder="Contact Person"
                  value={formData.contactPerson}
                  onChange={(e) => updateFormData("contactPerson", e.target.value)}
                  className="h-12 text-base pl-4 border border-gray-300 focus:border-[#115db1] focus:ring-1 focus:ring-[#115db1] rounded-lg transition-all duration-200"
                />
              </div>
              <div className="relative">
                <Input
                  placeholder="Phone number"
                  value={formData.phoneNumber}
                  onChange={(e) => updateFormData("phoneNumber", e.target.value)}
                  className="h-12 text-base pl-4 border border-gray-300 focus:border-[#115db1] focus:ring-1 focus:ring-[#115db1] rounded-lg transition-all duration-200"
                />
              </div>
              <div className="relative">
                <Input
                  placeholder="Email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => updateFormData("email", e.target.value)}
                  className="h-12 text-base pl-4 border border-gray-300 focus:border-[#115db1] focus:ring-1 focus:ring-[#115db1] rounded-lg transition-all duration-200"
                />
              </div>
              <div className="relative">
                <Input
                  placeholder="Password"
                  type={showPassword ? "text" : "password"}
                  value={formData.password}
                  onChange={(e) => updateFormData("password", e.target.value)}
                  className="h-12 text-base pl-4 pr-12 border border-gray-300 focus:border-[#115db1] focus:ring-1 focus:ring-[#115db1] rounded-lg transition-all duration-200"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>
            <div className="flex justify-end pt-6">
              <Button
                onClick={handleNext}
                className="bg-[#115db1] hover:bg-[#0d4a8f] px-8 py-3 rounded-lg text-white font-medium transition-all duration-200"
              >
                Agree and Continue
                <ChevronRight className="ml-2 w-4 h-4" />
              </Button>
            </div>
          </div>
        )

      case 1:
        return (
          <div className="flex flex-col gap-8 p-8">
            <div className="text-center space-y-3">
              <h2 className="text-2xl font-bold text-gray-900">Enter Event Details</h2>
              <p className="text-gray-600">Tell us about your amazing event</p>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="space-y-6">
                <Input
                  placeholder="Event Name"
                  value={formData.eventName}
                  onChange={(e) => updateFormData("eventName", e.target.value)}
                  className="h-12 text-base border border-gray-300 focus:border-[#115db1] focus:ring-1 focus:ring-[#115db1] rounded-lg transition-all duration-200"
                />
                <Input
                  placeholder="Event Type"
                  value={formData.eventType}
                  onChange={(e) => updateFormData("eventType", e.target.value)}
                  className="h-12 text-base border border-gray-300 focus:border-[#115db1] focus:ring-1 focus:ring-[#115db1] rounded-lg transition-all duration-200"
                />
                <Textarea
                  placeholder="Event Description"
                  className="h-32 text-base resize-none border border-gray-300 focus:border-[#115db1] focus:ring-1 focus:ring-[#115db1] rounded-lg transition-all duration-200"
                  value={formData.eventDescription}
                  onChange={(e) => updateFormData("eventDescription", e.target.value)}
                />
              </div>
              <div className="space-y-6">
                <Input
                  type="datetime-local"
                  value={formData.eventDateTime}
                  onChange={(e) => updateFormData("eventDateTime", e.target.value)}
                  className="h-12 text-base border border-gray-300 focus:border-[#115db1] focus:ring-1 focus:ring-[#115db1] rounded-lg transition-all duration-200"
                />
                <Input
                  placeholder="Event Location"
                  value={formData.eventLocation}
                  onChange={(e) => updateFormData("eventLocation", e.target.value)}
                  className="h-12 text-base border border-gray-300 focus:border-[#115db1] focus:ring-1 focus:ring-[#115db1] rounded-lg transition-all duration-200"
                />
                <Input
                  type="number"
                  placeholder="Expected Attendees"
                  value={formData.expectedAttendees}
                  onChange={(e) => updateFormData("expectedAttendees", e.target.value)}
                  className="h-12 text-base border border-gray-300 focus:border-[#115db1] focus:ring-1 focus:ring-[#115db1] rounded-lg transition-all duration-200"
                />
              </div>
            </div>
            <div className="flex justify-end pt-6">
              <Button
                onClick={handleNext}
                className="bg-[#115db1] hover:bg-[#0d4a8f] px-8 py-3 rounded-lg text-white font-medium transition-all duration-200"
              >
                Continue
                <ChevronRight className="ml-2 w-4 h-4" />
              </Button>
            </div>
          </div>
        )

      case 2:
        return (
          <div className="flex flex-col gap-8 p-8">
            <div className="text-center space-y-3">
              <h2 className="text-2xl font-bold text-gray-900">Enter Event Details</h2>
              <p className="text-gray-600">Configure your ticket types and restrictions</p>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
              <div className="space-y-8">
                <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
                  <h3 className="text-lg font-semibold mb-6 text-gray-900 flex items-center">
                    <Sparkles className="mr-3 w-5 h-5 text-[#115db1]" />
                    What type of tickets are you offering?
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {["Regular", "VIP", "VVIP", "Early Bird", "Bundle Tick"].map((type) => (
                      <Button
                        key={type}
                        variant="outline"
                        className={`h-10 text-sm rounded-lg transition-all duration-200 font-medium ${
                          formData.ticketTypes[type.toLowerCase().replace(" ", "") as keyof typeof formData.ticketTypes]
                            ? "bg-[#115db1] text-white border-[#115db1]"
                            : "bg-white text-gray-700 border-gray-300 hover:border-[#115db1] hover:text-[#115db1]"
                        }`}
                        onClick={() => {
                          const key = type.toLowerCase().replace(" ", "") as keyof typeof formData.ticketTypes
                          updateFormData("ticketTypes", {
                            ...formData.ticketTypes,
                            [key]: !formData.ticketTypes[key],
                          })
                        }}
                      >
                        {type}
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
                  <h3 className="text-lg font-semibold mb-6 text-gray-900 flex items-center">
                    <Shield className="mr-3 w-5 h-5 text-[#115db1]" />
                    Age Restriction?
                  </h3>
                  <div className="space-y-4">
                    <div className="flex items-center space-x-3">
                      <Checkbox
                        id="age-restriction"
                        className="w-4 h-4 rounded border-2 data-[state=checked]:bg-[#115db1] data-[state=checked]:border-[#115db1]"
                      />
                      <label htmlFor="age-restriction" className="text-base text-gray-900 font-medium">
                        Does your event have an age restriction?
                      </label>
                    </div>
                    <div className="flex items-center space-x-3">
                      <Checkbox
                        id="no-restriction"
                        className="w-4 h-4 rounded border-2 data-[state=checked]:bg-[#115db1] data-[state=checked]:border-[#115db1]"
                      />
                      <label htmlFor="no-restriction" className="text-base text-gray-900 font-medium">
                        No
                      </label>
                    </div>
                  </div>
                  <div className="grid grid-cols-4 md:grid-cols-7 gap-3 mt-6">
                    {["3+", "7+", "13+", "16+", "18+", "21+", "25+"].map((age) => (
                      <div key={age} className="flex items-center space-x-2">
                        <Checkbox
                          id={age}
                          className="w-4 h-4 rounded border-2 data-[state=checked]:bg-[#115db1] data-[state=checked]:border-[#115db1]"
                        />
                        <label htmlFor={age} className="text-sm text-gray-600">
                          {age}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-8">
                <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
                  <h3 className="text-lg font-semibold mb-6 text-gray-900 flex items-center">
                    <TrendingUp className="mr-3 w-5 h-5 text-[#115db1]" />
                    Discount / Promotion
                  </h3>
                  <p className="text-base text-gray-600 mb-6">Will you offer Promo codes</p>
                  <div className="space-y-4">
                    <div className="flex items-center space-x-3">
                      <Checkbox
                        id="promo-yes"
                        checked={formData.offerPromo}
                        onCheckedChange={(checked) => updateFormData("offerPromo", checked)}
                        className="w-4 h-4 rounded border-2 data-[state=checked]:bg-[#115db1] data-[state=checked]:border-[#115db1]"
                      />
                      <label htmlFor="promo-yes" className="text-base text-gray-900 font-medium">
                        Yes
                      </label>
                    </div>
                    <div className="flex items-center space-x-3">
                      <Checkbox
                        id="promo-no"
                        checked={!formData.offerPromo}
                        onCheckedChange={(checked) => updateFormData("offerPromo", !checked)}
                        className="w-4 h-4 rounded border-2 data-[state=checked]:bg-[#115db1] data-[state=checked]:border-[#115db1]"
                      />
                      <label htmlFor="promo-no" className="text-base text-gray-900 font-medium">
                        No
                      </label>
                    </div>
                    <Input
                      placeholder="Promo Code"
                      className="h-10 text-base mt-6 border border-gray-300 focus:border-[#115db1] focus:ring-1 focus:ring-[#115db1] rounded-lg transition-all duration-200"
                      value={formData.promoCode}
                      onChange={(e) => updateFormData("promoCode", e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </div>
            <div className="flex justify-center pt-8">
              <Button
                onClick={handleNext}
                className="bg-[#115db1] hover:bg-[#0d4a8f] px-12 py-3 text-base rounded-lg font-medium transition-all duration-200"
              >
                Continue
                <ChevronRight className="ml-2 w-4 h-4" />
              </Button>
            </div>
          </div>
        )

      case 3:
        return (
          <div className="flex flex-col gap-8 p-8">
            <div className="text-center space-y-3">
              <h2 className="text-2xl font-bold text-gray-900">Enter Additional Information</h2>
              <p className="text-gray-600">Choose additional services to enhance your event</p>
            </div>
            <div className="space-y-8">
              <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
                <h3 className="text-lg font-semibold mb-4 text-gray-900 flex items-center">
                  <Zap className="mr-3 w-5 h-5 text-[#115db1]" />
                  Marketing Support?
                </h3>
                <p className="text-gray-600 mb-6">
                  (We can help you promote the event through social media and email campaigns)
                </p>
                <div className="space-y-3">
                  <div className="flex items-center space-x-3">
                    <Checkbox
                      id="marketing-yes"
                      checked={formData.marketingSupport}
                      onCheckedChange={(checked) => updateFormData("marketingSupport", checked)}
                      className="w-4 h-4 rounded border-2 data-[state=checked]:bg-[#115db1] data-[state=checked]:border-[#115db1]"
                    />
                    <label htmlFor="marketing-yes" className="text-base text-gray-900 font-medium">
                      Yes
                    </label>
                  </div>
                  <div className="flex items-center space-x-3">
                    <Checkbox
                      id="marketing-no"
                      checked={!formData.marketingSupport}
                      onCheckedChange={(checked) => updateFormData("marketingSupport", !checked)}
                      className="w-4 h-4 rounded border-2 data-[state=checked]:bg-[#115db1] data-[state=checked]:border-[#115db1]"
                    />
                    <label htmlFor="marketing-no" className="text-base text-gray-900 font-medium">
                      No
                    </label>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
                <h3 className="text-lg font-semibold mb-4 text-gray-900 flex items-center">
                  <Sparkles className="mr-3 w-5 h-5 text-[#115db1]" />
                  Request Exposure through Front Page Advertising
                </h3>
                <div className="space-y-3">
                  <div className="flex items-center space-x-3">
                    <Checkbox
                      id="frontpage-yes"
                      checked={formData.frontPageAd}
                      onCheckedChange={(checked) => updateFormData("frontPageAd", checked)}
                      className="w-4 h-4 rounded border-2 data-[state=checked]:bg-[#115db1] data-[state=checked]:border-[#115db1]"
                    />
                    <label htmlFor="frontpage-yes" className="text-base text-gray-900 font-medium">
                      Yes
                    </label>
                  </div>
                  <div className="flex items-center space-x-3">
                    <Checkbox
                      id="frontpage-no"
                      checked={!formData.frontPageAd}
                      onCheckedChange={(checked) => updateFormData("frontPageAd", !checked)}
                      className="w-4 h-4 rounded border-2 data-[state=checked]:bg-[#115db1] data-[state=checked]:border-[#115db1]"
                    />
                    <label htmlFor="frontpage-no" className="text-base text-gray-900 font-medium">
                      No
                    </label>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
                <h3 className="text-lg font-semibold mb-4 text-gray-900 flex items-center">
                  <Users className="mr-3 w-5 h-5 text-[#115db1]" />
                  Onsite Support? (Will you need help managing your event?)
                </h3>
                <div className="space-y-3">
                  <div className="flex items-center space-x-3">
                    <Checkbox
                      id="onsite-yes"
                      checked={formData.onsiteSupport}
                      onCheckedChange={(checked) => updateFormData("onsiteSupport", checked)}
                      className="w-4 h-4 rounded border-2 data-[state=checked]:bg-[#115db1] data-[state=checked]:border-[#115db1]"
                    />
                    <label htmlFor="onsite-yes" className="text-base text-gray-900 font-medium">
                      Yes
                    </label>
                  </div>
                  <div className="flex items-center space-x-3">
                    <Checkbox
                      id="onsite-no"
                      checked={!formData.onsiteSupport}
                      onCheckedChange={(checked) => updateFormData("onsiteSupport", !checked)}
                      className="w-4 h-4 rounded border-2 data-[state=checked]:bg-[#115db1] data-[state=checked]:border-[#115db1]"
                    />
                    <label htmlFor="onsite-no" className="text-base text-gray-900 font-medium">
                      No
                    </label>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex justify-center pt-8">
              <Button
                onClick={handleSubmit}
                disabled={isLoading}
                className="bg-[#115db1] hover:bg-[#0d4a8f] px-12 py-3 text-base rounded-lg font-medium transition-all duration-200"
              >
                {isLoading ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Submitting...
                  </div>
                ) : (
                  <>
                    <CheckCircle className="mr-2 w-4 h-4" />
                    Submit
                  </>
                )}
              </Button>
            </div>
          </div>
        )

      default:
        return null
    }
  }

  return (
    <div className="min-h-screen" >
      {/* Professional Navigation Header */}
      <header className="bg-white/95 backdrop-blur-sm border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="text-2xl font-bold text-[#115db1]">Pazimo</div>
              </div>
            </div>
            <nav className="hidden md:flex space-x-8">
              <a
                href="#"
                className="text-gray-700 hover:text-[#115db1] px-3 py-2 text-sm font-medium transition-colors"
              >
                About Pazimo
              </a>
              <a
                href="#"
                className="text-gray-700 hover:text-[#115db1] px-3 py-2 text-sm font-medium transition-colors"
              >
                Events
              </a>
              <a
                href="#"
                className="text-gray-700 hover:text-[#115db1] px-3 py-2 text-sm font-medium transition-colors"
              >
                Pricing
              </a>
              <a
                href="#"
                className="text-gray-700 hover:text-[#115db1] px-3 py-2 text-sm font-medium transition-colors"
              >
                Support
              </a>
            </nav>
            <div className="flex items-center space-x-4">
             
              <Button
                onClick={() => setOpenDialog(true)}
                className="bg-[#115db1] hover:bg-[#0d4a8f] text-white rounded-lg px-6 py-2"
              >
                Get Started
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Registration Dialog */}
      <Dialog open={openDialog} onOpenChange={setOpenDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto border-0 shadow-xl rounded-2xl">
          <DialogHeader className="pb-6">
            <DialogTitle className="text-2xl font-bold text-center text-gray-900">Organizer Registration</DialogTitle>
          </DialogHeader>

          {/* Desktop Stepper */}
          <div className="hidden md:flex justify-between mb-8 px-4">
            {steps.map((step, index) => (
              <div
                key={step}
                className={`flex-1 text-center cursor-pointer transition-all duration-300 ${
                  index <= activeStep ? "text-[#115db1]" : "text-gray-400"
                }`}
                onClick={() => handleStepClick(index)}
              >
                <div
                  className={`w-8 h-8 rounded-full mx-auto mb-2 flex items-center justify-center text-sm font-semibold transition-all duration-300 ${
                    index <= activeStep ? "bg-[#115db1] text-white" : "bg-gray-200 text-gray-500"
                  }`}
                >
                  {index < activeStep ? <CheckCircle className="w-4 h-4" /> : index + 1}
                </div>
                <div className="text-xs font-medium">{step}</div>
                {index < steps.length - 1 && (
                  <div
                    className={`h-0.5 mt-2 mx-4 rounded-full transition-all duration-300 ${
                      index < activeStep ? "bg-[#115db1]" : "bg-gray-200"
                    }`}
                  />
                )}
              </div>
            ))}
          </div>

          {/* Mobile Navigation */}
          <div className="flex md:hidden justify-between items-center mb-6 px-4">
            <Button variant="outline" size="sm" onClick={handleBack} disabled={activeStep === 0} className="rounded-lg">
              <ChevronLeft className="w-4 h-4 mr-1" />
              Back
            </Button>
            <div className="flex space-x-2">
              {steps.map((_, index) => (
                <div
                  key={index}
                  className={`w-2 h-2 rounded-full transition-all duration-300 ${
                    index === activeStep
                      ? "bg-[#115db1]"
                      : index < activeStep
                        ? "bg-[#115db1] opacity-60"
                        : "bg-gray-300"
                  }`}
                />
              ))}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleNext}
              disabled={activeStep === steps.length - 1}
              className="rounded-lg"
            >
              Next
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>

          {renderStepContent()}
        </DialogContent>
      </Dialog>

      {/* Hero Section */}
      <section className="bg-white/10 backdrop-blur-sm px-4 md:px-20 py-20">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-8">
            <div className="inline-flex items-center px-4 py-2 bg-blue-100 text-blue-800 rounded-full text-sm font-medium mb-6">
              <Sparkles className="w-4 h-4 mr-2" />
              Solution For Event Organizers
            </div>
            <h1 className="text-4xl md:text-6xl font-bold text-gray-900 mb-6 leading-tight">
              Sell Tickets to Your Events <span className="text-[#115db1]">Hassle Free.</span>
            </h1>
            <p className="text-xl text-gray-600 leading-relaxed max-w-3xl mx-auto mb-8">
              Reach Thousands of Attendees & Grow Your Events with Pazimo Ticketing Platform.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button
                onClick={() => setOpenDialog(true)}
                className="bg-[#115db1] hover:bg-[#0d4a8f] px-8 py-4 text-lg rounded-lg font-medium transition-all duration-200"
              >
                <Sparkles className="mr-2 w-5 h-5" />
                Get Started
              </Button>
              <Button
                variant="outline"
                className="px-8 py-4 text-lg rounded-lg font-medium border-gray-300 text-gray-700 hover:border-[#115db1] hover:text-[#115db1] transition-all duration-200"
              >
                <Play className="mr-2 w-5 h-5" />
                Learn More
              </Button>
            </div>
          </div>
          <div className="flex justify-center">
            <div className="relative max-w-4xl">
              <div className="absolute inset-0 bg-[#115db1] rounded-3xl blur-3xl opacity-10 transform rotate-1" />
              <Image
                src="/images/pazimo.png"

                alt="Event organizer banner"
                width={800}
                height={500}
                className="relative w-full h-auto rounded-2xl shadow-2xl"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Why Choose Pazimo */}
      <section className="py-20 px-4">
        <div className="max-w-7xl mx-auto text-center">
          <div className="mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">
              Why Choose <span className="text-[#115db1]">Pazimo?</span>
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">The smart choice for Event Organizers</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <Card className="group border border-gray-200 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 rounded-2xl">
              <CardContent className="p-8 text-center space-y-6">
                <div className="bg-[#115db1]/10 rounded-2xl p-6 w-fit mx-auto transition-all duration-300 transform group-hover:scale-110">
                  <Image src="/images/organizer_clock.png" alt="Clock" width={32} height={32} />
                </div>
                <h3 className="text-xl font-bold text-gray-900">Easy Application Process</h3>
                <p className="text-gray-600 leading-relaxed">
                  Submit basic details, get verified fast, and access our secure dashboard instantly.
                </p>
              </CardContent>
            </Card>

            <Card className="group border border-gray-200 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 rounded-2xl">
              <CardContent className="p-8 text-center space-y-6">
                <div className="bg-[#115db1]/10 rounded-2xl p-6 w-fit mx-auto transition-all duration-300 transform group-hover:scale-110">
                  <Image src="/images/organizer_chart.png" alt="Chart" width={32} height={32} />
                </div>
                <h3 className="text-xl font-bold text-gray-900">Maximum Exposure</h3>
                <p className="text-gray-600 leading-relaxed">
                  Pazimo boosts your event with maximum exposure reach more attendees, sell more tickets, and grow your
                  audience effortlessly.
                </p>
              </CardContent>
            </Card>

            <Card className="group border border-gray-200 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 rounded-2xl">
              <CardContent className="p-8 text-center space-y-6">
                <div className="bg-[#115db1]/10 rounded-2xl p-6 w-fit mx-auto transition-all duration-300 transform group-hover:scale-110">
                  <Image src="/images/organizer_lock.png" alt="Lock" width={32} height={32} />
                </div>
                <h3 className="text-xl font-bold text-gray-900">Secure & Reliable</h3>
                <p className="text-gray-600 leading-relaxed">
                  Sell with zero stress. Pazimo's fraud-proof system guarantees secure transactions & 99.9% uptime.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* How to Apply */}
      <section className="py-20 px-4 bg-white/10 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto flex flex-col lg:flex-row items-center gap-16">
          <div className="flex-1">
            <div className="relative">
              <div className="absolute inset-0 bg-[#115db1] rounded-3xl blur-3xl opacity-10 transform -rotate-6" />
              <Image
                src="/images/organizer_illustration1.png"
                alt="How to apply illustration"
                width={500}
                height={400}
                className="relative w-full h-auto rounded-2xl shadow-2xl"
              />
            </div>
          </div>
          <div className="flex-1 space-y-8">
            <div className="space-y-6">
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 leading-tight">
                How to Apply as an <span className="text-[#115db1]">Event Organizer</span>
              </h2>
              <p className="text-lg text-gray-600 leading-relaxed">
                Applying as an event organizer on Pazimo is quick and effortless! Simply sign up with your basic
                details, verify your account in minutes, and get instant access to your secure dashboard. Upload your
                event info, set up tickets, and connect your preferred payment method all in just a few clicks.
              </p>
            </div>

            <div className="space-y-4">
              <div className="flex items-start gap-4 p-4 bg-white/95 backdrop-blur-sm rounded-lg shadow-sm hover:shadow-md transition-all duration-200 border border-gray-100">
                <div className="bg-[#115db1] rounded-full p-2 flex-shrink-0">
                  <CheckCircle className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900">Automated approval process</h4>
                  <p className="text-gray-600">No long waits, start selling tickets right away</p>
                </div>
              </div>

              <div className="flex items-start gap-4 p-4 bg-white/95 backdrop-blur-sm rounded-lg shadow-sm hover:shadow-md transition-all duration-200 border border-gray-100">
                <div className="bg-[#115db1] rounded-full p-2 flex-shrink-0">
                  <CheckCircle className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900">24/7 support team</h4>
                  <p className="text-gray-600">Ready to help if you need assistance</p>
                </div>
              </div>

              <div className="flex items-start gap-4 p-4 bg-white/95 backdrop-blur-sm rounded-lg shadow-sm hover:shadow-md transition-all duration-200 border border-gray-100">
                <div className="bg-[#115db1] rounded-full p-2 flex-shrink-0">
                  <CheckCircle className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900">Fast, secure, and hassle-free</h4>
                  <p className="text-gray-600">From sign-up to your first sale</p>
                </div>
              </div>
            </div>

            <Button
              onClick={() => setOpenDialog(true)}
              className="bg-[#115db1] hover:bg-[#0d4a8f] px-8 py-3 text-lg rounded-lg font-medium transition-all duration-200"
            >
              Register Now
              <ArrowRight className="ml-2 w-4 h-4" />
            </Button>
          </div>
        </div>
      </section>

      {/* Statistics */}
      <section className="bg-[#115db1] text-white py-20 px-4 relative overflow-hidden">
        <div className="absolute inset-0 bg-black/5" />
        <div className="relative max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-6">Making Moves, Breaking Records</h2>
            <p className="text-xl text-green-100 max-w-2xl mx-auto">
              We reached here with our hard work and dedication
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <div className="text-center group">
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 transition-all duration-300 group-hover:bg-white/20 group-hover:transform group-hover:scale-105">
                <Image
                  src="/images/organizer_Icon1.png"
                  alt="Members"
                  width={48}
                  height={48}
                  className="mx-auto mb-4"
                />
                <h3 className="text-3xl md:text-4xl font-bold mb-2">1000+</h3>
                <p className="text-green-100">Members</p>
              </div>
            </div>
            <div className="text-center group">
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 transition-all duration-300 group-hover:bg-white/20 group-hover:transform group-hover:scale-105">
                <Image
                  src="/images/organizer_Icon2.png"
                  alt="Tickets"
                  width={48}
                  height={48}
                  className="mx-auto mb-4"
                />
                <h3 className="text-3xl md:text-4xl font-bold mb-2">50+</h3>
                <p className="text-green-100">Sold Tickets</p>
              </div>
            </div>
            <div className="text-center group">
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 transition-all duration-300 group-hover:bg-white/20 group-hover:transform group-hover:scale-105">
                <Image
                  src="/images/organizer_Icon3.png"
                  alt="Organizers"
                  width={48}
                  height={48}
                  className="mx-auto mb-4"
                />
                <h3 className="text-3xl md:text-4xl font-bold mb-2">25</h3>
                <p className="text-green-100">Organizers</p>
              </div>
            </div>
            <div className="text-center group">
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 transition-all duration-300 group-hover:bg-white/20 group-hover:transform group-hover:scale-105">
                <CreditCard className="w-12 h-12 mx-auto mb-4 text-white" />
                <h3 className="text-3xl md:text-4xl font-bold mb-2">25,000+</h3>
                <p className="text-green-100">Transactions in ETB</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Security Section */}
      <section className="py-20 px-4">
        <div className="max-w-7xl mx-auto flex flex-col lg:flex-row items-center gap-16">
          <div className="flex-1">
            <div className="relative">
              <div className="absolute inset-0 bg-[#115db1] rounded-3xl blur-3xl opacity-10 transform rotate-6" />
              <Image
                src="/images/organizer_illustration2.png"
                alt="Security illustration"
                width={500}
                height={400}
                className="relative w-full h-auto rounded-2xl shadow-2xl"
              />
            </div>
          </div>
          <div className="flex-1 space-y-8">
            <div className="space-y-6">
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 leading-tight">
                <span className="text-[#115db1]">Secure Transactions,</span>
                <br />
                Smooth Experience
              </h2>
              <p className="text-lg text-gray-600 leading-relaxed">
                At Pazimo, security is our top priority. We understand the importance of keeping your data and
                transactions safe, which is why we implement advanced encryption protocols, multi-layered
                authentication, and continuous monitoring to protect both organizers and attendees.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-gray-50 p-6 rounded-lg border border-gray-100 hover:shadow-md transition-all duration-200">
                <Shield className="w-8 h-8 text-[#115db1] mb-4" />
                <h4 className="font-semibold text-gray-900 mb-2">Advanced Encryption</h4>
                <p className="text-gray-600 text-sm">Bank-level security protocols</p>
              </div>

              <div className="bg-gray-50 p-6 rounded-lg border border-gray-100 hover:shadow-md transition-all duration-200">
                <Zap className="w-8 h-8 text-[#115db1] mb-4" />
                <h4 className="font-semibold text-gray-900 mb-2">Real-time Processing</h4>
                <p className="text-gray-600 text-sm">Instant payment confirmation</p>
              </div>

              <div className="bg-gray-50 p-6 rounded-lg border border-gray-100 hover:shadow-md transition-all duration-200">
                <Users className="w-8 h-8 text-[#115db1] mb-4" />
                <h4 className="font-semibold text-gray-900 mb-2">Multiple Payment Gateways</h4>
                <p className="text-gray-600 text-sm">Flexible payment options</p>
              </div>

              <div className="bg-gray-50 p-6 rounded-lg border border-gray-100 hover:shadow-md transition-all duration-200">
                <TrendingUp className="w-8 h-8 text-[#115db1] mb-4" />
                <h4 className="font-semibold text-gray-900 mb-2">99.9% Uptime</h4>
                <p className="text-gray-600 text-sm">Reliable service guarantee</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 px-4 bg-white/10 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto text-center">
          <div className="mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">
              How does it <span className="text-[#115db1]">work?</span>
            </h2>
            <p className="text-xl text-gray-600 max-w-4xl mx-auto leading-relaxed mb-8">
              Applying as an event organizer on Pazimo is quick and effortless! Simply sign up with your basic details,
              verify your account in minutes, and get instant access to your secure dashboard.
            </p>
            <div className="inline-flex items-center gap-4 bg-white/95 backdrop-blur-sm rounded-2xl px-8 py-4 shadow-lg border border-gray-100">
              <span className="text-lg font-semibold text-gray-900">Sign up</span>
              <ChevronRight className="w-5 h-5 text-gray-600" />
              <span className="text-lg font-semibold text-gray-900">Pay how you want</span>
              <ChevronRight className="w-5 h-5 text-gray-600" />
              <span className="text-lg font-semibold text-gray-900">QR entry</span>
              <span className="text-lg font-bold text-green-600">Done!</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            <div className="group text-center space-y-6">
              <div className="relative">
                <div className="absolute inset-0 bg-[#115db1] rounded-3xl blur-2xl opacity-10 transform group-hover:scale-110 transition-all duration-300" />
                <div className="relative bg-white/95 backdrop-blur-sm rounded-2xl p-8 shadow-xl group-hover:shadow-2xl transition-all duration-300 transform group-hover:-translate-y-2 border border-gray-100">
                  <Image
                    src="/images/organizer_phone1.png"
                    alt="Sign up"
                    width={110}
                    height={200}
                    className="mx-auto"
                  />
                </div>
              </div>
              <div className="space-y-3">
                <h3 className="text-xl font-bold text-gray-900">Sign up in seconds</h3>
                <p className="text-gray-600">Just email & basic details.</p>
              </div>
            </div>

            <div className="group text-center space-y-6">
              <div className="relative">
                <div className="absolute inset-0 bg-[#115db1] rounded-3xl blur-2xl opacity-10 transform group-hover:scale-110 transition-all duration-300" />
                <div className="relative bg-white/95 backdrop-blur-sm rounded-2xl p-8 shadow-xl group-hover:shadow-2xl transition-all duration-300 transform group-hover:-translate-y-2 border border-gray-100">
                  <Image
                    src="/images/organizer_phone2.png"
                    alt="Payment"
                    width={110}
                    height={200}
                    className="mx-auto"
                  />
                </div>
              </div>
              <div className="space-y-3">
                <h3 className="text-xl font-bold text-gray-900">Attendees pay safely</h3>
                <p className="text-gray-600">Via Telebirr, CBE, or more</p>
              </div>
            </div>

            <div className="group text-center space-y-6">
              <div className="relative">
                <div className="absolute inset-0 bg-[#115db1] rounded-3xl blur-2xl opacity-10 transform group-hover:scale-110 transition-all duration-300" />
                <div className="relative bg-white/95 backdrop-blur-sm rounded-2xl p-8 shadow-xl group-hover:shadow-2xl transition-all duration-300 transform group-hover:-translate-y-2 border border-gray-100">
                  <div className="w-32 h-32 mx-auto bg-[#115db1] rounded-2xl flex items-center justify-center shadow-lg">
                    <div className="w-24 h-24 bg-white rounded-xl grid grid-cols-4 gap-1 p-3">
                      {Array.from({ length: 16 }).map((_, i) => (
                        <div key={i} className="bg-gray-900 rounded-sm" />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              <div className="space-y-3">
                <h3 className="text-xl font-bold text-gray-900">Unique QR codes</h3>
                <p className="text-gray-600">Sent instantly scan at entry for fast check-in</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Commission */}
      <section className="py-20 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">
              Transparent & Fair <span className="text-[#115db1]">Commission</span>
            </h2>
            <p className="text-xl text-gray-600 max-w-4xl mx-auto">
              Only 5% per ticket guaranteed. No hidden fees, no last-minute charges, no surprises. With Pazimo's
              industry-low flat rate, you keep more of your hard earned revenue while we handle payments, security, and
              support. What you see is what you pay always.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <div className="flex items-start gap-4 p-6 bg-gray-50 rounded-lg border border-gray-100 hover:shadow-md transition-all duration-200">
                <Image src="/images/tick.png" alt="Check" width={24} height={24} className="flex-shrink-0" />
                <div>
                  <span className="font-semibold text-gray-900">Locked-in rate promise: </span>
                  <span className="text-gray-600">
                    Your commission never increases, no matter how big your event grows.
                  </span>
                </div>
              </div>
              <div className="flex items-start gap-4 p-6 bg-gray-50 rounded-lg border border-gray-100 hover:shadow-md transition-all duration-200">
                <Image src="/images/tick.png" alt="Check" width={24} height={24} className="flex-shrink-0" />
                <div>
                  <span className="font-semibold text-gray-900">Compare and save: </span>
                  <span className="text-gray-600">
                    Other platforms charge 7-10%—we keep it fair at just 5%, forever.
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-[#115db1] text-white p-8 rounded-2xl shadow-2xl">
              <h3 className="text-3xl font-bold mb-8 text-center">Pricing Calculator</h3>
              <div className="space-y-6">
                <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 text-center">
                  <div className="text-4xl font-bold mb-2">5%</div>
                  <div className="text-green-100">Commission Rate</div>
                </div>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span>Ticket Price:</span>
                    <span className="font-semibold">$50</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Our Fee:</span>
                    <span className="font-semibold">$2.50</span>
                  </div>
                  <div className="border-t border-white/20 pt-4">
                    <div className="flex justify-between items-center text-lg font-bold">
                      <span>You Keep:</span>
                      <span>$47.50</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* App Download */}
      <section className="py-20 px-4 text-center bg-white/10 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto space-y-8">
          <div className="space-y-6">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900">
              Let's <span className="text-[#115db1]">Grow Together!</span>
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Download the Pazimo App and join thousands of organizers building unforgettable events—while keeping more
              of your profits.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row justify-center gap-6">
            <div className="group cursor-pointer">
              <div className="bg-white/95 backdrop-blur-sm rounded-2xl p-6 shadow-lg group-hover:shadow-xl transition-all duration-300 transform group-hover:scale-105 border border-gray-100">
                <Image
                  src="/images/organizer_app-store.png"
                  alt="Download on App Store"
                  width={180}
                  height={60}
                  className="cursor-pointer hover:opacity-80 transition-opacity"
                />
              </div>
            </div>
            <div className="group cursor-pointer">
              <div className="bg-white/95 backdrop-blur-sm rounded-2xl p-6 shadow-lg group-hover:shadow-xl transition-all duration-300 transform group-hover:scale-105 border border-gray-100">
                <Image
                  src="/images/organizer-playstore.png"
                  alt="Get it on Google Play"
                  width={180}
                  height={60}
                  className="cursor-pointer hover:opacity-80 transition-opacity"
                />
              </div>
            </div>
          </div>

          <div className="pt-8">
            <Button
              onClick={() => setOpenDialog(true)}
              className="bg-[#115db1] hover:bg-[#0d4a8f] px-10 py-4 text-lg rounded-lg font-medium transition-all duration-200"
            >
              <Sparkles className="mr-2 w-5 h-5" />
              Start Your Journey Today
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#115db1] text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <div className="text-2xl font-bold text-white mb-4">Pazimo</div>
              <p className="text-white">
                Connecting event organizers to the global market with powerful, easy-to-use tools.
              </p>
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-4">Automated approval process
</h3>
              <ul className="space-y-2 text-white">
                <li>
                  <a href="#" className="hover:text-white transition-colors">
                    Features
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white transition-colors">
                    Pricing
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white transition-colors">
                    API
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-4">Company</h3>
              <ul className="space-y-2 text-white">
                <li>
                  <a href="#" className="hover:text-white transition-colors">
                    About
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white transition-colors">
                    Blog
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white transition-colors">
                    Careers
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-4">Support</h3>
              <ul className="space-y-2 text-white">
                <li>
                  <a href="#" className="hover:text-white transition-colors">
                    Help Center
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white transition-colors">
                    Contact
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white transition-colors">
                    Status
                  </a>
                </li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 mt-8 pt-8 text-center text-white">
            <p>&copy; 2024 Pazimo. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
