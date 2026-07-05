export function PublicFooter() {
  return (
    <footer className="peas-public-footer">
      <div>
        <a className="peas-public-footer-brand" href="/index.html">
          <img src="/Components/images/spud-logo.png" alt="" />
          <span>PeAS</span>
        </a>
        <p>Office of Research & Publications, St. Paul University Dumaguete</p>
      </div>
      <nav aria-label="Footer navigation">
        <a href="/index.html">Home</a>
        <a href="/contact.html">Contact</a>
        <a href="/pages/miscellaneous/T&A-Public.html">Terms</a>
        <a href="/pages/miscellaneous/Privacy.html">Privacy</a>
      </nav>
    </footer>
  );
}
