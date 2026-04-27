import Navbar from "./organizer-componenets/Navbar";
import HeroSection from "./organizer-componenets/HeroSection";
import FeaturesSection from "./organizer-componenets/FeaturesSection";
import EventTypesSection from "./organizer-componenets/EventTypesSection";
import PricingSection from "./organizer-componenets/PricingSection";
import MilestonesSection from "./organizer-componenets/MilestonesSection";
import PartnersSection from "./organizer-componenets/PartnersSection";
import CTASection from "./organizer-componenets/CTASection";
import Footer from "./organizer-componenets/Footer";


const Index = () => {
  return (
    <div className="bg-background">
      <Navbar />
      <HeroSection />
      <FeaturesSection />
      <EventTypesSection />
      <PricingSection />
      <MilestonesSection />
      <PartnersSection />
      <CTASection />
      <Footer />
    </div >
  );
};

export default Index;
