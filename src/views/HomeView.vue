<template>
  <div class="home-container">
    <div class="hero-section">
      <div class="hero-content">
        <div class="badge">INTERVIEW SIMULATOR</div>
        <h1>Master Your Next <span class="highlight">Interview</span></h1>
        <p class="hero-description">
          Practice with our automated interviewer tailored to your resume and target role.
          Get real-time feedback and video analysis to boost your confidence.
        </p>
        <div class="hero-actions">
          <el-button v-if="canStartInterview" type="primary" class="primary-hero-btn" @click="startNewInterview">
            Practice Interview Now <i class="el-icon-right"></i>
          </el-button>
          <el-button v-if="canViewTranscriptions" class="secondary-hero-btn" @click="$router.push({name: 'TranscriptionsView'})">
            <i class="el-icon-document"></i> View Transcriptions
          </el-button>
        </div>
      </div>
      <div class="hero-visual">
        <div class="visual-card">
          <img src="https://www.diyotech.net/logo-transparent.svg" alt="Diyo Logo" class="visual-logo" />
          <div class="card-dots"></div>
        </div>
      </div>
    </div>

    <div class="features-section">
      <div class="feature-card">
        <div class="feature-icon"><i class="el-icon-document"></i></div>
        <h3>Resume Matching</h3>
        <p>The system analyzes your resume to generate relevant industry-specific questions.</p>
      </div>
      <div class="feature-card">
        <div class="feature-icon"><i class="el-icon-video-camera"></i></div>
        <h3>Video Context</h3>
        <p>Record your sessions to review non-verbal cues and body language.</p>
      </div>
      <div class="feature-card">
        <div class="feature-icon"><i class="el-icon-cpu"></i></div>
        <h3>Detailed Evaluation</h3>
        <p>Instant analysis of filler words, confidence, and response quality.</p>
      </div>
    </div>
  </div>
</template>

<script>
import authService from '@/services/authService';

export default {
  name: 'HomeView',
  computed: {
    canStartInterview() {
      const allowed = ['ADMIN', 'SUPER_ADMIN', 'DIYO_EMP', 'COPILOT_USER', 'DIYO_EXTERNAL'];
      const rawRoles = authService.getUserRoles();
      const roles = Array.isArray(rawRoles) ? rawRoles : (typeof rawRoles === 'string' ? [rawRoles] : []);
      const normalizedRoles = roles.map(r => String(r).trim().toUpperCase());
      return normalizedRoles.some(role => allowed.includes(role));
    },
    canViewTranscriptions() {
      const allowed = ['ADMIN', 'SUPER_ADMIN', 'DIYO_EMP'];
      const rawRoles = authService.getUserRoles();
      const roles = Array.isArray(rawRoles) ? rawRoles : (typeof rawRoles === 'string' ? [rawRoles] : []);
      const normalizedRoles = roles.map(r => String(r).trim().toUpperCase());
      return normalizedRoles.some(role => allowed.includes(role));
    }
  },
  methods: {
    startNewInterview() {
      if (authService.isLoggedIn()) {
        this.$router.push({ name: 'ResumeSetup' });
      } else {
        this.$router.push({ name: 'Login' });
      }
    }
  }
};
</script>

<style scoped>
.home-container {
  min-height: calc(100vh - 70px);
  padding: 60px 40px;
  background-color: #f9fafe;
  font-family: var(--font-family);
}

.hero-section {
  display: grid;
  grid-template-columns: 1.2fr 0.8fr;
  gap: 60px;
  max-width: 1200px;
  margin: 0 auto 80px;
  align-items: center;
}

.hero-content {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.badge {
  background: #eff6ff;
  color: #2563eb;
  padding: 6px 14px;
  border-radius: 20px;
  font-size: 0.8rem;
  font-weight: 700;
  letter-spacing: 0.5px;
  width: fit-content;
}

.hero-content h1 {
  font-size: 3.5rem;
  font-weight: 800;
  color: #1a1a1a;
  line-height: 1.1;
  margin: 0;
}

.highlight {
  color: #2563eb;
  position: relative;
}

.hero-description {
  font-size: 1.15rem;
  color: #4b5563;
  line-height: 1.6;
  max-width: 540px;
  margin: 0;
}

.hero-actions {
  display: flex;
  align-items: center;
  gap: 20px;
  margin-top: 10px;
}

.secondary-hero-btn {
  font-weight: 600 !important;
  color: #1e293b !important;
  font-size: 1rem !important;
  padding: 14px 28px !important;
  border-radius: 12px !important;
  height: auto !important;
  border: 2px solid #e2e8f0 !important;
  background: white !important;
  transition: all 0.3s !important;
}

.secondary-hero-btn:hover {
  color: #2563eb !important;
  border-color: #2563eb !important;
  background: #eff6ff !important;
}

.hero-visual {
  display: flex;
  justify-content: flex-end;
}

.visual-card {
  width: 100%;
  aspect-ratio: 1;
  background: white;
  border-radius: 24px;
  padding: 40px;
  box-shadow: 0 20px 40px rgba(0,0,0,0.05);
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
}

.visual-logo {
  width: 80%;
  max-width: 200px;
  border-radius: 12px;
}

.card-dots {
  position: absolute;
  top: 20px;
  right: 20px;
  width: 40px;
  height: 40px;
  background-image: radial-gradient(#2563eb 2px, transparent 2px);
  background-size: 8px 8px;
}

.features-section {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 30px;
  max-width: 1200px;
  margin: 0 auto;
}

.feature-card {
  background: white;
  padding: 30px;
  border-radius: 16px;
  border: 1px solid #f1f5f9;
  transition: all 0.3s;
}

.feature-card:hover {
  transform: translateY(-5px);
  box-shadow: 0 10px 20px rgba(0,0,0,0.04);
}

.feature-icon {
  width: 48px;
  height: 48px;
  background: #eff6ff;
  color: #2563eb;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.5rem;
  margin-bottom: 20px;
}

.feature-card h3 {
  margin: 0 0 12px;
  font-size: 1.2rem;
  color: #1a1a1a;
}

.feature-card p {
  margin: 0;
  color: #64748b;
  line-height: 1.5;
  font-size: 0.95rem;
}

@media (max-width: 968px) {
  .home-container {
    padding: 40px 20px;
  }
  .hero-section {
    grid-template-columns: 1fr;
    text-align: center;
    gap: 40px;
    margin-bottom: 60px;
  }
  .hero-content {
    align-items: center;
  }
  .hero-content h1 {
    font-size: 2.8rem;
  }
  .hero-visual {
    justify-content: center;
    order: -1;
  }
  .visual-card {
    max-width: 260px;
  }
  .features-section {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 480px) {
  .hero-content h1 {
    font-size: 2.2rem;
  }
  .hero-actions {
    flex-direction: column;
    width: 100%;
    gap: 12px;
  }
  .primary-hero-btn {
    width: 100%;
    padding: 14px 20px !important;
  }
  .visual-card {
    padding: 20px;
  }
}
</style>