"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Music, Users, Award, Ticket, Trophy, Calendar, Star, Zap } from "lucide-react"

interface Category {
  _id: string
  name: string
  description: string
  image?: string
  isPublished: boolean
}

export default function CategoryIcons() {
  const router = useRouter()
  const [categories, setCategories] = useState<Category[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [currentIndex, setCurrentIndex] = useState(0)
  const maxVisibleCards = { mobile: 3, tablet: 4, desktop: 5, large: 6 }
  const [visibleCards, setVisibleCards] = useState(maxVisibleCards.desktop)
  
  // Touch/swipe state for seamless scrolling
  const [touchStart, setTouchStart] = useState<number | null>(null)
  const [touchEnd, setTouchEnd] = useState<number | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [dragOffset, setDragOffset] = useState(0)
  const carouselRef = useRef<HTMLDivElement>(null)

  const getIconForCategory = (categoryName: string) => {
    const name = categoryName.toLowerCase()
    if (name.includes('music') || name.includes('concert')) return <Music className="w-8 h-8 text-white" />
    if (name.includes('education') || name.includes('workshop')) return <Users className="w-8 h-8 text-white" />
    if (name.includes('vip') || name.includes('premium')) return <Award className="w-8 h-8 text-white" />
    if (name.includes('festival') || name.includes('party')) return <Ticket className="w-8 h-8 text-white" />
    if (name.includes('sport') || name.includes('game')) return <Trophy className="w-8 h-8 text-white" />
    if (name.includes('conference') || name.includes('meeting')) return <Calendar className="w-8 h-8 text-white" />
    if (name.includes('entertainment') || name.includes('show')) return <Star className="w-8 h-8 text-white" />
    return <Zap className="w-8 h-8 text-white" />
  }

  const getColorsForCategory = (index: number) => {
    const colors = [
      { bg: "bg-slate-600", hover: "hover:bg-slate-700", shadow: "shadow-slate-500/20" },
      { bg: "bg-indigo-600", hover: "hover:bg-indigo-700", shadow: "shadow-indigo-500/20" },
      { bg: "bg-gray-600", hover: "hover:bg-gray-700", shadow: "shadow-gray-500/20" },
      { bg: "bg-amber-600", hover: "hover:bg-amber-700", shadow: "shadow-amber-500/20" },
      { bg: "bg-emerald-600", hover: "hover:bg-emerald-700", shadow: "shadow-emerald-500/20" },
      { bg: "bg-purple-600", hover: "hover:bg-purple-700", shadow: "shadow-purple-500/20" },
      { bg: "bg-rose-600", hover: "hover:bg-rose-700", shadow: "shadow-rose-500/20" },
      { bg: "bg-blue-600", hover: "hover:bg-blue-700", shadow: "shadow-blue-500/20" },
    ]
    return colors[index % colors.length]
  }

  const handleCategoryClick = useCallback((categoryId: string) => {
    if (!isDragging) {
              // console.log('Navigating to category:', categoryId) // Debug log
      router.push(`/event_explore?category=${categoryId}`)
    }
  }, [router, isDragging])

  const nextSlide = useCallback(() => {
    setCurrentIndex(prev => prev < categories.length - visibleCards ? prev + 1 : 0)
  }, [categories.length, visibleCards])

  const prevSlide = useCallback(() => {
    setCurrentIndex(prev => prev > 0 ? prev - 1 : categories.length - visibleCards)
  }, [categories.length, visibleCards])

  // Enhanced touch handlers for seamless scrolling
  // const handleTouchStart = (e: React.TouchEvent) => {
  //   e.preventDefault()
  //   setTouchStart(e.targetTouches[0].clientX)
  //   setTouchEnd(null)
  //   setIsDragging(true)
  //   setDragOffset(0)
  // }

  // const handleTouchMove = (e: React.TouchEvent) => {
  //   if (!touchStart) return
    
  //   e.preventDefault()
  //   const currentTouch = e.targetTouches[0].clientX
  //   const distance = touchStart - currentTouch
  //   setDragOffset(-distance * 0.1) // Reduce sensitivity for smoother feel
  //   setTouchEnd(currentTouch)
  // }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStart === null) return
  
    const currentTouch = e.targetTouches[0].clientX
    const distance = touchStart - currentTouch
    setDragOffset(-distance * 0.1)
    setTouchEnd(currentTouch)
  
    // Only enable dragging if swipe is large enough
    if (Math.abs(distance) > 10) {
      setIsDragging(true)
    }
  }
  

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStart || !touchEnd) return
    
    e.preventDefault()
    const distance = touchStart - touchEnd
    const minSwipeDistance = 50

    if (Math.abs(distance) > minSwipeDistance) {
      if (distance < 0) { // Swipe right -> go to previous slide
        prevSlide()
      } else { // Swipe left -> go to next slide
        nextSlide()
      }
    }

    setTouchStart(null)
    setTouchEnd(null)
    setIsDragging(false)
    setDragOffset(0)
  }

  // Enhanced mouse handlers for desktop seamless scrolling
  // const handleMouseDown = (e: React.MouseEvent) => {
  //   e.preventDefault()
  //   setTouchStart(e.clientX)
  //   setTouchEnd(null)
  //   setIsDragging(true)
  //   setDragOffset(0)
  // }

  // const handleMouseMove = (e: React.MouseEvent) => {
  //   if (!touchStart || !isDragging) return
    
  //   e.preventDefault()
  //   const currentX = e.clientX
  //   const distance = touchStart - currentX
  //   setDragOffset(-distance * 0.1) // Reduce sensitivity for smoother feel
  //   setTouchEnd(currentX)
  // }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!touchStart) return
  
    const currentX = e.clientX
    const distance = touchStart - currentX
    setDragOffset(-distance * 0.1)
    setTouchEnd(currentX)
  
    // Only enable dragging if swipe is large enough
    if (Math.abs(distance) > 10) {
      setIsDragging(true)
    }
  }

  
  const handleTouchStart = (e: React.TouchEvent) => {
    e.preventDefault()
    setTouchStart(e.targetTouches[0].clientX)
    setTouchEnd(null)
    setIsDragging(false)  // <- Start as false
    setDragOffset(0)
  }
  
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    setTouchStart(e.clientX)
    setTouchEnd(null)
    setIsDragging(false)  // <- Start as false
    setDragOffset(0)
  }
  

  const handleMouseUp = (e: React.MouseEvent) => {
    if (!touchStart || !touchEnd) return
    
    e.preventDefault()
    const distance = touchStart - touchEnd
    const minSwipeDistance = 50

    if (Math.abs(distance) > minSwipeDistance) {
      if (distance < 0) { // Swipe right -> go to previous slide
        prevSlide()
      } else { // Swipe left -> go to next slide
        nextSlide()
      }
    }

    setTouchStart(null)
    setTouchEnd(null)
    setIsDragging(false)
    setDragOffset(0)
  }

  const handleMouseLeave = () => {
    setTouchStart(null)
    setTouchEnd(null)
    setIsDragging(false)
    setDragOffset(0)
  }

  // Update visible cards based on screen size
  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth
      if (width < 640) {
        setVisibleCards(maxVisibleCards.mobile)
      } else if (width < 768) {
        setVisibleCards(maxVisibleCards.tablet)
      } else if (width < 1280) {
        setVisibleCards(maxVisibleCards.desktop)
      } else {
        setVisibleCards(maxVisibleCards.large)
      }
    }
    handleResize()
    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [])

  // Auto-scroll with pause on hover
  useEffect(() => {
    if (categories.length <= visibleCards) return
    
    const interval = setInterval(() => {
      if (!isDragging) {
        nextSlide()
      }
    }, 5000)
    
    return () => clearInterval(interval)
  }, [categories.length, visibleCards, isDragging, nextSlide])

  useEffect(() => {
    fetchCategories()
  }, [])

  const fetchCategories = async () => {
    try {
      setIsLoading(true)
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/categories`)
      
      if (!response.ok) {
        throw new Error('Failed to fetch categories')
      }

      const data = await response.json()
      const publishedCategories = data.data.filter((category: Category) => category.isPublished)
      setCategories(publishedCategories)
    } catch (error) {
      console.error('Error fetching categories:', error)
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex justify-center mt-12 mb-16">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-600"></div>
      </div>
    )
  }

  if (categories.length === 0) {
    return null
  }

  return (
    <div className="mt-12 mb-16 px-4">
      {/* Mobile: Show 3 with carousel if more */}
      <div className="md:hidden">
        {categories.length > 3 ? (
          <div className="relative">
            <div 
              ref={carouselRef}
              className="overflow-hidden select-none touch-pan-y" 
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseLeave}
              style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
            >
              <div
                className="flex transition-transform duration-300 ease-in-out"
                style={{ 
                  transform: `translateX(calc(-${currentIndex * (100 / visibleCards)}% + ${dragOffset}px))`,
                  transition: isDragging ? 'none' : 'transform 300ms ease-in-out'
                }}
              >
                {categories.map((category, index) => {
                  const colors = getColorsForCategory(index)
                  
                  return (
                    <div 
                      key={category._id} 
                      className="flex flex-col items-center group cursor-pointer flex-shrink-0 px-2"
                      style={{ width: `${100 / visibleCards}%` }}
                      onClick={() => handleCategoryClick(category._id)}
                    >
                      <div className="relative">
                        <div className={`absolute inset-0 ${colors.bg} rounded-full blur-md opacity-0 group-hover:opacity-20 transition-all duration-300 scale-110`} />
                        <div className={`relative w-20 h-20 ${colors.bg} ${colors.hover} rounded-full flex items-center justify-center transition-all duration-300 shadow-lg overflow-hidden`}>
                          {category.image ? (
                            <img 
                              src={`${process.env.NEXT_PUBLIC_API_URL}${category.image}`}
                              alt={category.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            getIconForCategory(category.name)
                          )}
                        </div>
                        <div className={`absolute inset-0 rounded-full border-2 border-gray-200 opacity-0 group-hover:opacity-100 transition-all duration-300 scale-110 group-hover:scale-115`} />
                      </div>
                      <div className="mt-4 text-center">
                        <span className="text-sm font-semibold text-gray-700 group-hover:text-[#1a2d5a] transition-all duration-300 inline-block">
                          {category.name}
                        </span>
                        <div className={`h-0.5 ${colors.bg} scale-x-0 group-hover:scale-x-100 transition-transform duration-300 mt-1 rounded-full`} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex justify-center gap-8">
            {categories.map((category, index) => {
              const colors = getColorsForCategory(index)
              
              return (
                <div 
                  key={category._id} 
                  className="flex flex-col items-center group cursor-pointer"
                  onClick={() => handleCategoryClick(category._id)}
                >
                  <div className="relative">
                    <div className={`absolute inset-0 ${colors.bg} rounded-full blur-md opacity-0 group-hover:opacity-20 transition-all duration-300 scale-110`} />
                    <div className={`relative w-20 h-20 ${colors.bg} ${colors.hover} rounded-full flex items-center justify-center transition-all duration-300 shadow-lg overflow-hidden`}>
                      {category.image ? (
                        <img 
                          src={`${process.env.NEXT_PUBLIC_API_URL}${category.image}`}
                          alt={category.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        getIconForCategory(category.name)
                      )}
                    </div>
                    <div className={`absolute inset-0 rounded-full border-2 border-gray-200 opacity-0 group-hover:opacity-100 transition-all duration-300 scale-110 group-hover:scale-115`} />
                  </div>
                  <div className="mt-4 text-center">
                    <span className="text-sm font-semibold text-gray-700 group-hover:text-[#1a2d5a] transition-all duration-300 inline-block">
                      {category.name}
                    </span>
                    <div className={`h-0.5 ${colors.bg} scale-x-0 group-hover:scale-x-100 transition-transform duration-300 mt-1 rounded-full`} />
                  </div>
                </div>
              )
            })}
          </div>
        )}
          </div>
          
      {/* Desktop: Show 5 categories per page with carousel navigation */}
      <div className="hidden md:block">
        <div className="max-w-6xl mx-auto relative">
          <div 
            ref={carouselRef}
            className="overflow-hidden select-none touch-pan-y" 
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseLeave}
            style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
          >
            <div
              className="flex transition-transform duration-300 ease-in-out"
              style={{ 
                transform: `translateX(calc(-${currentIndex * (100 / visibleCards)}% + ${dragOffset}px))`,
                transition: isDragging ? 'none' : 'transform 300ms ease-in-out'
              }}
            >
          {categories.map((category, index) => {
            const colors = getColorsForCategory(index)
            
            return (
              <div 
                key={category._id} 
                    className="flex flex-col items-center group cursor-pointer flex-shrink-0 px-4"
                    style={{ width: `${100 / visibleCards}%` }}
                onClick={() => handleCategoryClick(category._id)}
              >
                <div className="relative">
                  <div className={`absolute inset-0 ${colors.bg} rounded-full blur-md opacity-0 group-hover:opacity-20 transition-all duration-300 scale-110`} />
                      <div className={`relative w-24 h-24 ${colors.bg} ${colors.hover} rounded-full flex items-center justify-center transition-all duration-300 shadow-lg overflow-hidden`}>
                    {category.image ? (
                      <img 
                        src={`${process.env.NEXT_PUBLIC_API_URL}${category.image}`}
                        alt={category.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      getIconForCategory(category.name)
                    )}
                  </div>
                  <div className={`absolute inset-0 rounded-full border-2 border-gray-200 opacity-0 group-hover:opacity-100 transition-all duration-300 scale-110 group-hover:scale-115`} />
                </div>
                <div className="mt-4 text-center">
                      <span className="text-base font-semibold text-gray-700 group-hover:text-[#1a2d5a] transition-all duration-300 inline-block">
                    {category.name}
                  </span>
                  <div className={`h-0.5 ${colors.bg} scale-x-0 group-hover:scale-x-100 transition-transform duration-300 mt-1 rounded-full`} />
                </div>
              </div>
            )
          })}
        </div>
          </div>
        </div>
      </div>
    </div>
  )
}
