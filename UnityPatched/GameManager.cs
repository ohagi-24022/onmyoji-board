using UnityEngine;
using TMPro;
using UnityEngine.UI;

public class GameManager : MonoBehaviour
{
    [SerializeField] private TextMeshProUGUI enemiesText;
    [SerializeField] private TextMeshProUGUI turnsText;
    [SerializeField] private GameObject clearPanel;
    [SerializeField] private GameObject gameOverPanel;

    private int currentTurns;
    private bool cleared;
    private bool gameOver;

    public bool IsGameEnded
    {
        get { return cleared || gameOver; }
    }

    private void Awake()
    {
        SetupPanels();
        HidePanels();
    }

    private void Update()
    {
        RefreshEnemies();
    }

    public void SetTurns(int turns)
    {
        SetTurns(turns, 0);
    }

    public void SetTurns(int turns, int destroyedEnemies)
    {
        currentTurns = turns;
        RefreshTurns();
        CheckEndState(destroyedEnemies);
    }

    public void RefreshEnemies()
    {
        RefreshEnemies(GameObject.FindGameObjectsWithTag("Enemy").Length);
    }

    private void RefreshEnemies(int enemyCount)
    {
        if (enemyCount < 0)
        {
            enemyCount = 0;
        }

        if (enemiesText != null)
        {
            enemiesText.text = "Enemies: " + enemyCount;
        }

        if (!cleared && enemyCount <= 0)
        {
            StageClear();
        }
    }

    private void RefreshTurns()
    {
        if (turnsText != null)
        {
            turnsText.text = "Turns: " + currentTurns;
        }
    }

    private void CheckEndState(int destroyedEnemies)
    {
        int enemyCount = GameObject.FindGameObjectsWithTag("Enemy").Length - destroyedEnemies;
        RefreshEnemies(enemyCount);

        if (!cleared && !gameOver && currentTurns <= 0)
        {
            GameOver();
        }
    }

    private void StageClear()
    {
        cleared = true;
        if (clearPanel != null)
        {
            clearPanel.SetActive(true);
        }
        Debug.Log("Stage Clear");
    }

    private void GameOver()
    {
        gameOver = true;
        if (gameOverPanel != null)
        {
            gameOverPanel.SetActive(true);
        }
        Debug.Log("Game Over");
    }

    private void SetupPanels()
    {
        Canvas canvas = FindObjectOfType<Canvas>();
        if (canvas == null)
        {
            return;
        }

        if (clearPanel == null)
        {
            clearPanel = FindPanel(canvas.transform, "ClearPanel");
        }

        if (gameOverPanel == null)
        {
            gameOverPanel = FindPanel(canvas.transform, "GameOverPanel");
        }

        if (clearPanel == null)
        {
            clearPanel = CreatePanel(canvas.transform, "ClearPanel", "Stage Clear");
        }

        if (gameOverPanel == null)
        {
            gameOverPanel = CreatePanel(canvas.transform, "GameOverPanel", "Game Over");
        }
    }

    private void HidePanels()
    {
        if (clearPanel != null)
        {
            clearPanel.SetActive(false);
        }

        if (gameOverPanel != null)
        {
            gameOverPanel.SetActive(false);
        }
    }

    private GameObject FindPanel(Transform canvasTransform, string panelName)
    {
        Transform panel = canvasTransform.Find(panelName);
        if (panel == null)
        {
            return null;
        }

        return panel.gameObject;
    }

    private GameObject CreatePanel(Transform parent, string panelName, string message)
    {
        GameObject panel = new GameObject(panelName);
        panel.transform.SetParent(parent, false);
        panel.AddComponent<CanvasRenderer>();

        RectTransform panelRect = panel.AddComponent<RectTransform>();
        panelRect.anchorMin = Vector2.zero;
        panelRect.anchorMax = Vector2.one;
        panelRect.offsetMin = Vector2.zero;
        panelRect.offsetMax = Vector2.zero;

        Image image = panel.AddComponent<Image>();
        image.color = new Color(0f, 0f, 0f, 0.65f);

        GameObject textObject = new GameObject("Text");
        textObject.transform.SetParent(panel.transform, false);

        RectTransform textRect = textObject.AddComponent<RectTransform>();
        textRect.anchorMin = Vector2.zero;
        textRect.anchorMax = Vector2.one;
        textRect.offsetMin = Vector2.zero;
        textRect.offsetMax = Vector2.zero;

        TextMeshProUGUI text = textObject.AddComponent<TextMeshProUGUI>();
        text.text = message;
        text.fontSize = 48f;
        text.alignment = TextAlignmentOptions.Center;
        text.color = Color.white;

        return panel;
    }
}
