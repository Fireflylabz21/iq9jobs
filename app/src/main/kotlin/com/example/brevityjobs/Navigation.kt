package com.example.brevityjobs

import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Person
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import androidx.navigation.toRoute
import com.example.brevityjobs.ui.auth.LoginScreen
import com.example.brevityjobs.ui.onboarding.AgentOnboardingScreen
import com.example.brevityjobs.ui.profile.AboutUsScreen
import com.example.brevityjobs.ui.profile.ProfileSettingsScreen
import com.example.brevityjobs.ui.seeker.feed.SeekerFeedUiState
import com.example.brevityjobs.ui.seeker.feed.SeekerFeedViewModel
import com.example.brevityjobs.ui.seeker.feed.SwipeableRoleCardDeck
import com.example.brevityjobs.ui.web.ApplicationWebScreen

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MainNavigation() {
  val navController = rememberNavController()
  var currentSeekerId by remember { mutableStateOf<String?>(null) }
  val navBackStackEntry by navController.currentBackStackEntryAsState()
  val currentDestination = navBackStackEntry?.destination

  val seekerFeedViewModel: SeekerFeedViewModel = hiltViewModel()
  val uiState by seekerFeedViewModel.uiState.collectAsStateWithLifecycle()

  val showBars = currentDestination?.route?.let { route ->
    route != LoginKey::class.qualifiedName &&
            !route.startsWith(AgentOnboardingKey::class.qualifiedName.orEmpty()) &&
            route != ProfileSettingsKey::class.qualifiedName &&
            route != AboutUsKey::class.qualifiedName &&
            !route.startsWith(ApplicationWebKey::class.qualifiedName.orEmpty())
  } ?: false

  Scaffold(
    modifier = Modifier.fillMaxSize(),
    containerColor = Color(0xFF020617),
    topBar = {
      if (showBars) {
        TopAppBar(
          title = {
            Row(verticalAlignment = Alignment.CenterVertically) {
              Image(
                painter = painterResource(id = R.drawable.app_icon),
                contentDescription = "iq9 Logo",
                modifier = Modifier.size(32.dp)
              )
              Spacer(modifier = Modifier.width(8.dp))
              Text(
                text = "iq9 Jobs",
                style = MaterialTheme.typography.titleLarge.copy(
                  fontWeight = FontWeight.Bold,
                  color = Color.White,
                  fontSize = 20.sp
                )
              )
            }
          },
          colors = TopAppBarDefaults.topAppBarColors(
            containerColor = Color(0xFF020617),
            titleContentColor = Color.White
          ),
          actions = {
            IconButton(onClick = { navController.navigate(ProfileSettingsKey) }) {
              Icon(Icons.Default.Person, contentDescription = "Profile Settings", tint = Color(0xFF38BDF8))
            }
          }
        )
      }
    },
  ) { innerPadding ->
    NavHost(
      navController = navController,
      startDestination = LoginKey,
      modifier = Modifier.padding(innerPadding)
    ) {
      composable<LoginKey> {
        LoginScreen(
          onLoginSuccess = { email, onboardingComplete ->
            currentSeekerId = email
            seekerFeedViewModel.setSeekerId(email)
            val destination = if (onboardingComplete) SeekerFeedKey else AgentOnboardingKey(email = email)
            navController.navigate(destination) {
              popUpTo(LoginKey) { inclusive = true }
            }
          }
        )
      }
      composable<AgentOnboardingKey> { backStackEntry ->
        val args = backStackEntry.toRoute<AgentOnboardingKey>()
        AgentOnboardingScreen(
          initialEmail = args.email,
          onComplete = {
            seekerFeedViewModel.refreshProfile()
            navController.navigate(SeekerFeedKey) {
              popUpTo<AgentOnboardingKey> { inclusive = true }
            }
          }
        )
      }
      composable<ProfileSettingsKey> {
        ProfileSettingsScreen(
          userId = currentSeekerId.orEmpty(),
          onAboutUs = { navController.navigate(AboutUsKey) },
          onLogout = {
            currentSeekerId = null
            seekerFeedViewModel.setSeekerId(null)
            navController.navigate(LoginKey) {
              popUpTo(navController.graph.findStartDestination().id) { inclusive = true }
            }
          }
        )
      }
      composable<AboutUsKey> {
        AboutUsScreen(onBack = { navController.popBackStack() })
      }
      composable<SeekerFeedKey> {
        when (val state = uiState) {
          is SeekerFeedUiState.Loading -> {
            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
              CircularProgressIndicator(color = Color(0xFF38BDF8))
            }
          }
          is SeekerFeedUiState.Success -> {
            SwipeableRoleCardDeck(
              jobs = state.jobs,
              onOpenApplication = { job ->
                val url = job.applyUrl.orEmpty()
                navController.navigate(ApplicationWebKey(url = url, title = job.title))
              },
              onToggleSaved = { job, isSaved ->
                seekerFeedViewModel.setJobSaved(job.id, isSaved)
              },
              onJobSkipped = { job ->
                seekerFeedViewModel.skipJob(job)
              },
              onApplicationStarted = { job ->
                seekerFeedViewModel.recordApplicationStarted(job)
              }
            )
          }
          is SeekerFeedUiState.Error -> {
            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
              Text(text = "Error: ${state.message}", color = MaterialTheme.colorScheme.error)
            }
          }
        }
      }
      composable<ApplicationWebKey> { backStackEntry ->
        val args = backStackEntry.toRoute<ApplicationWebKey>()
        ApplicationWebScreen(
          title = args.title,
          url = args.url,
          onBack = { navController.popBackStack() }
        )
      }
    }
  }
}
