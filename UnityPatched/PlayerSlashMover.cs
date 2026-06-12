using UnityEngine;
using TMPro;
using System.Collections;

public class PlayerSlashMover : MonoBehaviour
{
    [SerializeField] private float maxDistance = 6f;
    [SerializeField] private int turns = 5;
    [SerializeField] private LineRenderer line;
    [SerializeField] private LayerMask wallLayer;
    [SerializeField] private TextMeshProUGUI turnsText;
    [SerializeField] private GameManager gameManager;
    [SerializeField] private float wallOffset = 0.2f;
    [SerializeField] private TextMeshProUGUI missText;

    private Vector2 startPos;
    private Vector2 dragStart;
    private Camera mainCamera;
    private bool dragging;
    private Coroutine missCoroutine;

    private void Start()
    {
        mainCamera = Camera.main;

        if (gameManager == null)
        {
            gameManager = FindObjectOfType<GameManager>();
        }

        if (wallLayer.value == 0)
        {
            wallLayer = LayerMask.GetMask("Wall");
        }

        if (line != null)
        {
            line.positionCount = 2;
            line.enabled = false;
        }

        SetupMissText();
        HideMissText();
        UpdateTurnsUI();
    }

    private void Update()
    {
        if (turns <= 0 || mainCamera == null || IsGameEnded())
        {
            return;
        }

        if (Input.GetMouseButtonDown(0))
        {
            dragging = true;
            dragStart = MouseWorld();
            startPos = transform.position;
            UpdateLine(startPos, startPos);
        }

        if (dragging && Input.GetMouseButton(0))
        {
            UpdateLine(startPos, GetTarget());
        }

        if (dragging && Input.GetMouseButtonUp(0))
        {
            dragging = false;

            int destroyedEnemies;
            bool hitWall = MoveAndSlash(startPos, GetTarget(), out destroyedEnemies);
            if (!hitWall)
            {
                ShowMiss();
            }

            turns -= hitWall ? 1 : 2;
            UpdateTurnsUI(destroyedEnemies);

            if (line != null)
            {
                line.enabled = false;
            }
        }
    }

    private Vector2 MouseWorld()
    {
        return mainCamera.ScreenToWorldPoint(Input.mousePosition);
    }

    private Vector2 GetTarget()
    {
        Vector2 now = MouseWorld();
        Vector2 dir = dragStart - now;
        return startPos + Vector2.ClampMagnitude(dir, maxDistance);
    }

    private void UpdateLine(Vector2 from, Vector2 to)
    {
        if (line == null)
        {
            return;
        }

        line.enabled = true;
        line.SetPosition(0, new Vector3(from.x, from.y, 0f));
        line.SetPosition(1, new Vector3(to.x, to.y, 0f));
    }

    private bool MoveAndSlash(Vector2 from, Vector2 to, out int destroyedEnemies)
    {
        destroyedEnemies = 0;
        Vector2 move = to - from;
        float distance = move.magnitude;

        if (distance <= 0.001f)
        {
            return false;
        }

        Vector2 direction = move / distance;
        RaycastHit2D wallHit = Physics2D.Raycast(from, direction, distance, wallLayer);
        bool hitWall = wallHit.collider != null;
        float slashDistance = distance;

        if (hitWall)
        {
            to = wallHit.point - direction * wallOffset;
            slashDistance = Vector2.Distance(from, to);
        }

        RaycastHit2D[] hits = Physics2D.RaycastAll(from, direction, slashDistance);

        foreach (RaycastHit2D hit in hits)
        {
            if (hit.collider != null && hit.collider.CompareTag("Enemy"))
            {
                destroyedEnemies++;
                Destroy(hit.collider.gameObject);
            }
        }

        if (hitWall)
        {
            transform.position = to;
        }

        return hitWall;
    }

    private void UpdateTurnsUI()
    {
        UpdateTurnsUI(0);
    }

    private void UpdateTurnsUI(int destroyedEnemies)
    {
        if (turnsText != null)
        {
            turnsText.text = "Turns: " + turns;
        }

        if (gameManager != null)
        {
            gameManager.SetTurns(turns, destroyedEnemies);
        }
    }

    private bool IsGameEnded()
    {
        return gameManager != null && gameManager.IsGameEnded;
    }

    private void SetupMissText()
    {
        if (missText != null)
        {
            missText.text = "Miss";
            return;
        }

        Canvas canvas = FindObjectOfType<Canvas>();
        if (canvas == null)
        {
            return;
        }

        Transform found = canvas.transform.Find("MissText");
        if (found != null)
        {
            missText = found.GetComponent<TextMeshProUGUI>();
        }

        if (missText == null)
        {
            missText = CreateMissText(canvas.transform);
        }
    }

    private TextMeshProUGUI CreateMissText(Transform parent)
    {
        GameObject textObject = new GameObject("MissText");
        textObject.transform.SetParent(parent, false);

        RectTransform rect = textObject.AddComponent<RectTransform>();
        rect.anchorMin = new Vector2(0.5f, 0.5f);
        rect.anchorMax = new Vector2(0.5f, 0.5f);
        rect.anchoredPosition = Vector2.zero;
        rect.sizeDelta = new Vector2(300f, 100f);

        TextMeshProUGUI text = textObject.AddComponent<TextMeshProUGUI>();
        text.text = "Miss";
        text.fontSize = 48f;
        text.alignment = TextAlignmentOptions.Center;
        text.color = Color.red;

        return text;
    }

    private void ShowMiss()
    {
        if (missText == null)
        {
            return;
        }

        if (missCoroutine != null)
        {
            StopCoroutine(missCoroutine);
        }

        missCoroutine = StartCoroutine(ShowMissRoutine());
    }

    private IEnumerator ShowMissRoutine()
    {
        missText.gameObject.SetActive(true);
        yield return new WaitForSeconds(0.8f);
        HideMissText();
        missCoroutine = null;
    }

    private void HideMissText()
    {
        if (missText != null)
        {
            missText.gameObject.SetActive(false);
        }
    }
}
