function LocationSection() {
    return (
        <footer className="location-section">
            <div className="location-card">
                <span className="section-kicker">Ubicacion</span>
                <h2>Bolivar 2120</h2>
                <p>Mar del Plata, Argentina</p>

                <div className="footer-actions">
                    <a
                        href="https://maps.google.com/?q=Bolivar+2120+Mar+del+Plata"
                        target="_blank"
                        rel="noreferrer"
                        className="action-button"
                    >
                        Como llegar
                    </a>

                    <a href="#historia" className="text-link">
                        Nuestra historia
                    </a>
                </div>
            </div>
        </footer>
    );
}

export default LocationSection;
