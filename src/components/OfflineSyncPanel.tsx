import { useState } from "react";
import { useOfflineSyncContext } from "@/contexts/OfflineSyncContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { 
  Cloud, 
  CloudOff, 
  RefreshCw, 
  Database, 
  Trash2, 
  CheckCircle2, 
  AlertCircle,
  Loader2,
  Download
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

export function OfflineSyncPanel() {
  const {
    isOnline,
    pendingCount,
    isSyncing,
    syncProgress,
    sync,
    clearFailed,
    isPreloading,
    hasOfflineData,
    lastDataSync,
    offlineDataStats,
    preloadOfflineData,
    clearOfflineData,
  } = useOfflineSyncContext();
  
  const [showDetails, setShowDetails] = useState(false);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {isOnline ? (
              <Cloud className="h-5 w-5 text-green-500" />
            ) : (
              <CloudOff className="h-5 w-5 text-amber-500" />
            )}
            <div>
              <CardTitle className="text-lg">Synchronisation</CardTitle>
              <CardDescription>
                {isOnline ? "Connecté" : "Mode hors-ligne"}
              </CardDescription>
            </div>
          </div>
          <Badge variant={isOnline ? "default" : "secondary"}>
            {isOnline ? "En ligne" : "Hors-ligne"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Pending operations */}
        <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
          <div className="flex items-center gap-2">
            <Database className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm">Modifications en attente</span>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={pendingCount > 0 ? "destructive" : "outline"}>
              {pendingCount}
            </Badge>
            {pendingCount > 0 && isOnline && (
              <Button
                size="sm"
                variant="outline"
                onClick={sync}
                disabled={isSyncing}
              >
                {isSyncing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
              </Button>
            )}
          </div>
        </div>

        {/* Sync progress */}
        {isSyncing && syncProgress && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Synchronisation en cours...</span>
              <span>{syncProgress.current}/{syncProgress.total}</span>
            </div>
            <Progress value={(syncProgress.current / syncProgress.total) * 100} />
          </div>
        )}

        {/* Offline data status */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Données hors-ligne</span>
            {hasOfflineData ? (
              <CheckCircle2 className="h-4 w-4 text-green-500" />
            ) : (
              <AlertCircle className="h-4 w-4 text-amber-500" />
            )}
          </div>

          {hasOfflineData && lastDataSync && (
            <p className="text-xs text-muted-foreground">
              Dernière sync: {format(lastDataSync, "dd MMM yyyy à HH:mm", { locale: fr })}
            </p>
          )}

          {hasOfflineData && offlineDataStats && showDetails && (
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2 bg-muted/50 rounded">
                <span className="text-muted-foreground">Joueurs:</span>{" "}
                <span className="font-medium">{offlineDataStats.players}</span>
              </div>
              <div className="p-2 bg-muted/50 rounded">
                <span className="text-muted-foreground">Matchs:</span>{" "}
                <span className="font-medium">{offlineDataStats.matches}</span>
              </div>
              <div className="p-2 bg-muted/50 rounded">
                <span className="text-muted-foreground">Wellness:</span>{" "}
                <span className="font-medium">{offlineDataStats.wellness}</span>
              </div>
              <div className="p-2 bg-muted/50 rounded">
                <span className="text-muted-foreground">Blessures:</span>{" "}
                <span className="font-medium">{offlineDataStats.injuries}</span>
              </div>
            </div>
          )}

          {hasOfflineData && (
            <Button
              variant="ghost"
              size="sm"
              className="w-full"
              onClick={() => setShowDetails(!showDetails)}
            >
              {showDetails ? "Masquer les détails" : "Voir les détails"}
            </Button>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="flex-1"
            onClick={preloadOfflineData}
            disabled={isPreloading || !isOnline}
          >
            {isPreloading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Download className="h-4 w-4 mr-2" />
            )}
            {hasOfflineData ? "Actualiser" : "Télécharger"}
          </Button>
          
          {hasOfflineData && (
            <Button
              variant="outline"
              size="icon"
              onClick={clearOfflineData}
              title="Supprimer les données locales"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>

        {pendingCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-destructive hover:text-destructive"
            onClick={clearFailed}
          >
            Supprimer les modifications en échec
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
