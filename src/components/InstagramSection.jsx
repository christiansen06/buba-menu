function InstagramSection() {
    return (
        <section className="social-section">
            <div className="social-icon">📷</div>

            <div className="social-info">
                <span className="section-kicker">Instagram</span>
                <h2>@buba_mdq</h2>
                <p className="social-hint">Mirá nuestras novedades y promos</p>
            </div>

            <a
                href="https://instagram.com/buba_mdq"
                target="_blank"
                rel="noreferrer"
                className="social-button"
            >
                Ver perfil
            </a>
        </section>
    );
}

export default InstagramSection;