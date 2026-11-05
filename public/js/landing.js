// Landing Page Interactivity

document.addEventListener('DOMContentLoaded', () => {
  // Smooth scroll for "Learn More" button
  const learnMoreBtn = document.getElementById('scroll-features');
  if (learnMoreBtn) {
    learnMoreBtn.addEventListener('click', () => {
      const featuresSection = document.getElementById('features-section');
      if (featuresSection) {
        featuresSection.scrollIntoView({ behavior: 'smooth' });
      }
    });
  }

  // FAQ Accordion
  const faqToggles = document.querySelectorAll('.faq-toggle');
  faqToggles.forEach((toggle) => {
    toggle.addEventListener('click', () => {
      const faqItem = toggle.closest('.faq-item');
      const isActive = faqItem.classList.contains('active');

      // Close all other FAQs
      document.querySelectorAll('.faq-item.active').forEach((item) => {
        if (item !== faqItem) {
          item.classList.remove('active');
          item.querySelector('.faq-content').hidden = true;
        }
      });

      // Toggle current FAQ
      faqItem.classList.toggle('active');
      const content = faqItem.querySelector('.faq-content');
      content.hidden = !isActive;
    });
  });
});
