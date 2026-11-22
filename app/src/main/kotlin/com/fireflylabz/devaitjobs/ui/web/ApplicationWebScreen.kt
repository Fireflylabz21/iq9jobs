package com.fireflylabz.devaitjobs.ui.web

import android.graphics.Bitmap
import android.net.Uri
import android.os.Build
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ApplicationWebScreen(
    title: String,
    url: String,
    onBack: () -> Unit
) {
    val uri = remember(url) { runCatching { Uri.parse(url) }.getOrNull() }
    val isValidUrl = uri != null &&
        uri.scheme in setOf("https", "http") &&
        !uri.host.isNullOrBlank()
    var webView by remember { mutableStateOf<WebView?>(null) }
    var progress by remember { mutableIntStateOf(0) }
    var canGoBack by remember { mutableStateOf(false) }
    var loadError by remember { mutableStateOf<String?>(null) }

    fun navigateBack() {
        val view = webView
        if (view?.canGoBack() == true) {
            view.goBack()
        } else {
            onBack()
        }
    }

    BackHandler(enabled = canGoBack) {
        navigateBack()
    }

    val webViewToDispose = webView
    DisposableEffect(webViewToDispose) {
        onDispose {
            webViewToDispose?.stopLoading()
            webViewToDispose?.destroy()
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(title, maxLines = 1) },
                navigationIcon = {
                    IconButton(onClick = ::navigateBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                }
            )
        }
    ) { padding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
        ) {
            if (!isValidUrl) {
                Text(
                    text = "This application link is invalid.",
                    modifier = Modifier.align(Alignment.Center)
                )
            } else {
                AndroidView(
                    modifier = Modifier.fillMaxSize(),
                    factory = { context ->
                        WebView(context).apply {
                            webView = this
                            settings.javaScriptEnabled = true
                            settings.domStorageEnabled = true
                            settings.allowFileAccess = false
                            settings.allowContentAccess = false
                            settings.mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
                            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                                settings.safeBrowsingEnabled = true
                            }
                            webChromeClient = object : WebChromeClient() {
                                override fun onProgressChanged(view: WebView, newProgress: Int) {
                                    progress = newProgress
                                }
                            }
                            webViewClient = object : WebViewClient() {
                                override fun shouldOverrideUrlLoading(
                                    view: WebView,
                                    request: WebResourceRequest
                                ): Boolean {
                                    val requestedUri = request.url
                                    return requestedUri.scheme !in setOf("https", "http") ||
                                        requestedUri.host.isNullOrBlank()
                                }

                                override fun onPageStarted(
                                    view: WebView,
                                    url: String?,
                                    favicon: Bitmap?
                                ) {
                                    loadError = null
                                    canGoBack = view.canGoBack()
                                }

                                override fun onPageFinished(view: WebView, url: String?) {
                                    progress = 100
                                    canGoBack = view.canGoBack()
                                }

                                override fun onReceivedError(
                                    view: WebView,
                                    request: WebResourceRequest,
                                    error: WebResourceError
                                ) {
                                    if (request.isForMainFrame) {
                                        loadError = error.description.toString()
                                    }
                                }
                            }
                            loadUrl(uri.toString())
                        }
                    },
                    update = { view ->
                        webView = view
                    }
                )

                if (progress in 1..99) {
                    CircularProgressIndicator(
                        progress = { progress / 100f },
                        modifier = Modifier
                            .align(Alignment.TopCenter)
                            .fillMaxWidth(),
                        color = MaterialTheme.colorScheme.primary,
                        trackColor = Color.Transparent
                    )
                }
                loadError?.let { message ->
                    Column(
                        modifier = Modifier
                            .align(Alignment.BottomCenter)
                            .fillMaxWidth()
                            .padding(12.dp)
                    ) {
                        Text(
                            text = "Could not load the application page: $message",
                            color = MaterialTheme.colorScheme.error,
                            style = MaterialTheme.typography.bodySmall
                        )
                    }
                }
            }
        }
    }
}

