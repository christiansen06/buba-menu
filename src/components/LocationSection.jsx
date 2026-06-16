function LocationSection() {
    return (
        <footer className="location-section">
            <div className="location-card">
                <div className="location-pearl location-pearl-1" />
                <div className="location-pearl location-pearl-2" />

                <span className="section-kicker location-kicker">📍 Encontranos en</span>
                <h2>Bolívar 2120</h2>
                <p>Mar del Plata, Argentina</p>

                <div className="footer-actions">
                    <a
                        href="https://maps.google.com/?q=Bolivar+2120+Mar+del+Plata"
                        target="_blank"
                        rel="noreferrer"
                        className="action-button"
                    >
                        Cómo llegar
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