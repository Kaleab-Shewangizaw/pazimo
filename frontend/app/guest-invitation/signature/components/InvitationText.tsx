"use client";

export default function InvitationText() {
  return (
    <div className="text-center space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-serif font-bold text-yellow-300 tracking-wider">
          You&apos;re Invited
        </h1>
        <div className="w-24 h-1 bg-gradient-to-r from-yellow-600 to-yellow-400 mx-auto" />
      </div>

      <div className="space-y-4 text-yellow-100/90">
        <p className="text-lg font-serif italic">
          &quot;Join us for an evening of celebration&quot;
        </p>

        <div className="space-y-2">
          <h2 className="text-xl font-semibold text-yellow-200">
            Special Event Name
          </h2>
          <div className="flex items-center justify-center space-x-4 text-yellow-300/80">
            <div className="text-center">
              <p className="font-bold text-yellow-400">DATE</p>
              <p>December 25, 2024</p>
            </div>
            <div className="w-px h-8 bg-yellow-600/50" />
            <div className="text-center">
              <p className="font-bold text-yellow-400">TIME</p>
              <p>7:00 PM</p>
            </div>
            <div className="w-px h-8 bg-yellow-600/50" />
            <div className="text-center">
              <p className="font-bold text-yellow-400">VENUE</p>
              <p>Grand Ballroom</p>
            </div>
          </div>
        </div>

        <p className="text-yellow-200/70 pt-4 border-t border-yellow-700/30">
          We look forward to celebrating with you!
        </p>
      </div>
    </div>
  );
}
