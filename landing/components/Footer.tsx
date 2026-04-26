import Image from "next/image";

const Footer = () => {
  return (
    <footer className="py-10 border-t border-border">
      <div className="container mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
        <Image
          src="/images/paz/logo.png"
          alt="Pazimo"
          width={160}
          height={80}
          className="h-20 w-auto"
        />
        <p className="text-sm text-muted-foreground">© {new Date().getFullYear()} Pazimo. All rights reserved.</p>
      </div>
    </footer>
  );
};

export default Footer;
